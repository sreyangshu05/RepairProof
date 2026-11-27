from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    service_name: str = "RepairProof Invoice Intelligence"
    environment: str = "development"
    internal_api_token: str = "local-dev-token-change-me"
    extraction_signing_secret: str = "local-dev-signing-secret-change-me"
    max_document_bytes: int = 10 * 1024 * 1024
    max_pdf_pages: int = 5
    max_pixels_per_page: int = 18_000_000
    max_image_upscale: float = 2.0
    max_extracted_chars: int = 200_000
    ocr_timeout_seconds: int = 25
    max_concurrent_extractions: int = 2
    ocr_languages: str = "eng"
    tesseract_command: str = "tesseract"
    confidence_review_threshold: float = 0.75

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            environment=os.getenv("REPAIRPROOF_ENV", "development"),
            internal_api_token=os.getenv(
                "INVOICE_AI_INTERNAL_TOKEN", "local-dev-token-change-me"
            ),
            extraction_signing_secret=os.getenv(
                "INVOICE_AI_SIGNING_SECRET", "local-dev-signing-secret-change-me"
            ),
            max_document_bytes=_int_env(
                "INVOICE_AI_MAX_DOCUMENT_BYTES", 10 * 1024 * 1024
            ),
            max_pdf_pages=_int_env("INVOICE_AI_MAX_PDF_PAGES", 5),
            max_pixels_per_page=_int_env("INVOICE_AI_MAX_PIXELS_PER_PAGE", 18_000_000),
            ocr_timeout_seconds=_int_env("INVOICE_AI_OCR_TIMEOUT_SECONDS", 25),
            max_concurrent_extractions=_int_env("INVOICE_AI_MAX_CONCURRENT", 2),
            ocr_languages=os.getenv("INVOICE_AI_OCR_LANGUAGES", "eng"),
            tesseract_command=os.getenv("TESSERACT_CMD", "tesseract"),
            confidence_review_threshold=_float_env("INVOICE_AI_REVIEW_THRESHOLD", 0.75),
        )

    def validate(self) -> None:
        if self.environment.lower() in {"production", "prod"}:
            if (
                self.internal_api_token == "local-dev-token-change-me"
                or len(self.internal_api_token) < 32
            ):
                raise RuntimeError(
                    "INVOICE_AI_INTERNAL_TOKEN must be configured with at least 32 characters in production"
                )
            if (
                self.extraction_signing_secret == "local-dev-signing-secret-change-me"
                or len(self.extraction_signing_secret) < 32
            ):
                raise RuntimeError(
                    "INVOICE_AI_SIGNING_SECRET must be configured with at least 32 characters in production"
                )
        if (
            self.max_document_bytes <= 0
            or self.max_pdf_pages <= 0
            or self.max_pixels_per_page <= 0
        ):
            raise RuntimeError("Invoice document limits must be positive")
        if self.max_concurrent_extractions <= 0 or self.ocr_timeout_seconds <= 0:
            raise RuntimeError("Invoice processing limits must be positive")
        if not 0 < self.confidence_review_threshold <= 1:
            raise RuntimeError("INVOICE_AI_REVIEW_THRESHOLD must be between 0 and 1")


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be numeric") from exc
