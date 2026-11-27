from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import re
import shutil
from threading import BoundedSemaphore
from time import perf_counter
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.concurrency import run_in_threadpool

from .config import Settings
from .extraction import DocumentLimitError, InvoiceExtractionService
from .ocr import DocumentError, TesseractOCR
from .schemas import (
    CorrectionEntry,
    CorrectionReceipt,
    CorrectionRequest,
    InvoiceExtraction,
)

logger = logging.getLogger("repairproof.invoice_ai")
ALLOWED_FIELD_PATHS = {
    "fields.merchant",
    "fields.invoice_number",
    "fields.invoice_date",
    "fields.device_model",
    "fields.labour_charge",
    "fields.tax",
    "fields.total_amount",
    "fields.currency",
}
ITEM_PATH = re.compile(
    r"^component_items\[(\d{1,3})\]\.(component_description|quantity|unit_price)$"
)


def create_app(
    settings: Settings | None = None,
    extraction_service: InvoiceExtractionService | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.validate()
    service = extraction_service or InvoiceExtractionService(
        settings, TesseractOCR(settings)
    )
    concurrency_gate = BoundedSemaphore(settings.max_concurrent_extractions)

    app = FastAPI(
        title="RepairProof Invoice Intelligence API",
        summary="Private OCR-based invoice extraction with field-level uncertainty and human correction receipts.",
        description=(
            "Internal service for extracting candidate invoice fields. All extracted values remain unconfirmed "
            "suggestions until reviewed in RepairProof. This service cannot approve quotations or verify invoices."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    app.state.settings = settings
    app.state.extraction_service = service

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        candidate_request_id = request.headers.get("X-Request-ID", "")
        request.state.request_id = (
            candidate_request_id
            if re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", candidate_request_id)
            else str(uuid4())
        )
        started = perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        logger.info(
            "request_complete",
            extra={
                "request_id": request.state.request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round((perf_counter() - started) * 1000, 2),
            },
        )
        return response

    @app.exception_handler(DocumentError)
    @app.exception_handler(DocumentLimitError)
    async def document_error_handler(
        request: Request, exc: DocumentError | DocumentLimitError
    ):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": str(exc),
                    "request_id": request.state.request_id,
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "Request fields are invalid",
                    "request_id": request.state.request_id,
                },
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException):
        detail: dict[str, object] = exc.detail if isinstance(exc.detail, dict) else {}
        return JSONResponse(
            status_code=exc.status_code,
            headers=exc.headers,
            content={
                "error": {
                    "code": str(detail.get("code", "HTTP_ERROR")),
                    "message": str(
                        detail.get("message", "The request could not be completed")
                    ),
                    "request_id": request.state.request_id,
                },
            },
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception):
        logger.exception(
            "unhandled_invoice_service_error",
            extra={
                "request_id": request.state.request_id,
                "exception_type": type(exc).__name__,
            },
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Invoice processing could not be completed",
                    "request_id": request.state.request_id,
                },
            },
        )

    def require_internal_token(
        authorization: str | None = Header(default=None),
    ) -> None:
        expected = f"Bearer {settings.internal_api_token}"
        if not authorization or not hmac.compare_digest(authorization, expected):
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "UNAUTHORIZED",
                    "message": "A valid internal service credential is required",
                },
            )

    def require_reviewer_profile(
        reviewer_profile_id: str | None = Header(
            default=None, alias="X-RepairProof-Reviewer-Id"
        ),
    ) -> str:
        if (
            not reviewer_profile_id
            or not reviewer_profile_id.strip()
            or len(reviewer_profile_id) > 120
        ):
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "REVIEWER_ID_REQUIRED",
                    "message": "The authenticated RepairProof backend must provide a reviewer identity",
                },
            )
        return reviewer_profile_id.strip()

    @app.get("/health/live", tags=["health"], summary="Liveness check")
    async def live():
        return {"status": "alive"}

    @app.get("/health/ready", tags=["health"], summary="Readiness check")
    async def ready():
        backend = getattr(service, "ocr_backend", None)
        image_ocr = (
            "available"
            if isinstance(backend, TesseractOCR)
            and shutil.which(settings.tesseract_command)
            else (
                "injected"
                if backend is not None and not isinstance(backend, TesseractOCR)
                else "unavailable"
            )
        )
        pdf_support = _pdf_support_status()
        ready_state = image_ocr != "unavailable"
        payload = {
            "status": "ready" if ready_state else "not_ready",
            "image_ocr": image_ocr,
            "pdf_support": pdf_support,
            "max_document_bytes": settings.max_document_bytes,
            "max_pdf_pages": settings.max_pdf_pages,
        }
        return JSONResponse(status_code=200 if ready_state else 503, content=payload)

    @app.post(
        "/v1/invoices/extract",
        response_model=InvoiceExtraction,
        tags=["invoice extraction"],
        summary="Extract invoice fields as unconfirmed suggestions",
        dependencies=[Depends(require_internal_token)],
        responses={
            413: {
                "description": "Document size, dimensions, pages, or extracted text exceed configured limits"
            },
            415: {
                "description": "Unsupported document type or declared MIME does not match file bytes"
            },
            422: {
                "description": "Invalid, corrupt, encrypted, or undecodable document"
            },
            429: {"description": "Inference concurrency limit reached"},
            503: {"description": "OCR/PDF engine unavailable or processing timed out"},
        },
    )
    async def extract_invoice(
        request: Request,
        file: UploadFile = File(..., description="PDF, JPEG, PNG, or WebP invoice"),
    ):
        if not concurrency_gate.acquire(blocking=False):
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "INFERENCE_BUSY",
                    "message": "Invoice processing is at capacity; retry shortly",
                },
                headers={"Retry-After": "5"},
            )
        started = perf_counter()
        try:
            data = await _read_bounded(file, settings.max_document_bytes)
            extraction = await run_in_threadpool(
                service.extract, data, file.content_type or ""
            )
            signed = _sign_extraction(extraction, settings.extraction_signing_secret)
            logger.info(
                "invoice_extraction_complete",
                extra={
                    "request_id": request.state.request_id,
                    "extraction_id": str(signed.extraction_id),
                    "document_sha256": signed.document_sha256,
                    "review_required_count": len(signed.review_required_paths),
                    "duration_ms": round((perf_counter() - started) * 1000, 2),
                },
            )
            return signed
        except ValueError as exc:
            raise HTTPException(
                status_code=422, detail={"code": "EMPTY_DOCUMENT", "message": str(exc)}
            ) from exc
        finally:
            concurrency_gate.release()

    @app.post(
        "/v1/invoices/corrections",
        response_model=CorrectionReceipt,
        tags=["human review"],
        summary="Record a human correction to extracted suggestions",
        description=(
            "Internal callers must authenticate the human in RepairProof, preserve the original extraction, and persist this receipt. "
            "A correction records human input; it does not independently verify invoice authenticity or approve a quotation."
        ),
        dependencies=[Depends(require_internal_token)],
    )
    async def record_corrections(
        request: Request,
        body: CorrectionRequest,
        reviewer_profile_id: str = Depends(require_reviewer_profile),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ):
        if not idempotency_key or not re.fullmatch(
            r"[A-Za-z0-9._:-]{8,128}", idempotency_key
        ):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "IDEMPOTENCY_KEY_REQUIRED",
                    "message": "Supply a unique Idempotency-Key for this correction submission",
                },
            )
        _verify_extraction_signature(
            body.extraction, settings.extraction_signing_secret
        )
        entries: list[CorrectionEntry] = []
        for path, value in body.corrections.items():
            field = _resolve_extraction_field(body.extraction, path)
            if value is not None:
                value = value.strip()
                if (
                    not value
                    or len(value) > 500
                    or any(ord(ch) < 32 and ch not in "\t\n\r" for ch in value)
                ):
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "INVALID_CORRECTION",
                            "message": f"Correction for {path} must be nonblank printable text up to 500 characters",
                        },
                    )
            entries.append(
                CorrectionEntry(
                    field_path=path,
                    previous_suggestion=field.value,
                    corrected_value=value,
                )
            )

        receipt = CorrectionReceipt(
            correction_id=uuid4(),
            extraction_id=body.extraction.extraction_id,
            document_sha256=body.extraction.document_sha256,
            reviewer_profile_id=reviewer_profile_id,
            submitted_at=datetime.now(timezone.utc),
            note=body.note.strip() if body.note and body.note.strip() else None,
            corrections=entries,
        )
        # Durable deduplication is performed by the caller's system-of-record transaction.
        logger.info(
            "invoice_corrections_recorded",
            extra={
                "request_id": request.state.request_id,
                "extraction_id": str(receipt.extraction_id),
                "correction_id": str(receipt.correction_id),
                "reviewer_profile_id": receipt.reviewer_profile_id,
                "corrected_field_count": len(entries),
                "idempotency_key": idempotency_key,
            },
        )
        return receipt

    return app


async def _read_bounded(file: UploadFile, maximum_bytes: int) -> bytes:
    chunks: list[bytes] = []
    size = 0
    while chunk := await file.read(64 * 1024):
        size += len(chunk)
        if size > maximum_bytes:
            raise HTTPException(
                status_code=413,
                detail={
                    "code": "DOCUMENT_TOO_LARGE",
                    "message": f"Document exceeds the {maximum_bytes} byte limit",
                },
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _signature_payload(extraction: InvoiceExtraction) -> bytes:
    payload = extraction.model_dump(mode="json", exclude={"integrity_signature"})
    return json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    ).encode("utf-8")


def _sign_extraction(extraction: InvoiceExtraction, secret: str) -> InvoiceExtraction:
    signature = hmac.new(
        secret.encode("utf-8"), _signature_payload(extraction), hashlib.sha256
    ).hexdigest()
    return extraction.model_copy(update={"integrity_signature": signature})


def _verify_extraction_signature(extraction: InvoiceExtraction, secret: str) -> None:
    expected = hmac.new(
        secret.encode("utf-8"), _signature_payload(extraction), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(extraction.integrity_signature, expected):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "EXTRACTION_SIGNATURE_INVALID",
                "message": "The extraction was modified or its review token is invalid",
            },
        )


def _resolve_extraction_field(extraction: InvoiceExtraction, path: str):
    if path in ALLOWED_FIELD_PATHS:
        return getattr(extraction.fields, path.removeprefix("fields."))
    match = ITEM_PATH.fullmatch(path)
    if not match:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_CORRECTION_PATH",
                "message": f"Unsupported invoice field path: {path[:100]}",
            },
        )
    index = int(match.group(1))
    if index >= len(extraction.component_items):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_CORRECTION_PATH",
                "message": "Component row does not exist in this extraction",
            },
        )
    return getattr(extraction.component_items[index], match.group(2))


def _pdf_support_status() -> str:
    try:
        import pymupdf  # noqa: F401

        return "available"
    except ImportError:
        return "unavailable"


app = create_app()
