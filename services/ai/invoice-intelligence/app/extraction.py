from __future__ import annotations

from decimal import Decimal, InvalidOperation
import hashlib
import re
from typing import Literal, cast
from uuid import uuid4

from .config import Settings
from .ocr import (
    OCRLine,
    SUPPORTED_MIME_TYPES,
    read_document,
    sniff_mime,
    OCRBackend,
)
from .schemas import (
    ExtractedField,
    InvoiceExtraction,
    InvoiceFields,
    InvoiceLineItem,
    SourceSpan,
)


AMOUNT_RE = re.compile(
    r"(?<![A-Za-z0-9])(?:[$\u20ac\u00a3\u20b9]\s*)?[-+]?(?:\d{1,3}(?:[,. ]\d{3})+|\d+)(?:[.,]\d{1,2})?(?:\s*(?:USD|EUR|GBP|INR|CAD|AUD))?(?![A-Za-z0-9])",
    re.I,
)
DATE_RE = re.compile(
    r"\b(?:\d{1,4}[./-]\d{1,2}[./-]\d{1,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b"
)
LABELS = {
    "merchant": re.compile(
        r"\b(?:merchant|supplier|vendor|seller|billed\s+by|sold\s+by)\b\s*[:#-]?\s*(.*)$",
        re.I,
    ),
    "invoice_number": re.compile(
        r"\b(?:invoice\s*(?:no\.?|number|#)|inv\.?\s*(?:no\.?|#)|bill\s*(?:no\.?|number|#)|receipt\s*(?:no\.?|number|#))\s*[:#-]?\s*(.*)$",
        re.I,
    ),
    "invoice_date": re.compile(
        r"\b(?:invoice\s+date|bill\s+date|date)\b\s*[:#-]?\s*(.*)$", re.I
    ),
    "device_model": re.compile(
        r"\b(?:device\s+model|phone\s+model|laptop\s+model|model)\b\s*[:#-]?\s*(.*)$",
        re.I,
    ),
    "labour_charge": re.compile(
        r"\b(?:labou?r|service|repair)\s+(?:charge|cost|fee)\b\s*[:#-]?\s*(.*)$", re.I
    ),
    "tax": re.compile(r"\b(?:tax|vat|gst|sales\s+tax)\b\s*[:#-]?\s*(.*)$", re.I),
}
TOTAL_LABELS = [
    re.compile(
        r"\b(?:grand\s+total|amount\s+due|balance\s+due|total\s+due|amount\s+payable)\b\s*[:#-]?\s*(.*)$",
        re.I,
    ),
    re.compile(r"\b(?:invoice\s+total|total\s+amount|total)\b\s*[:#-]?\s*(.*)$", re.I),
]
EXCLUDED_ROW_WORDS = re.compile(
    r"\b(?:subtotal|grand\s+total|amount\s+due|balance\s+due|total|tax|vat|gst|labou?r|service\s+charge|discount|invoice\s+no|date|device\s+model|model|serial|imei)\b",
    re.I,
)


class InvoiceExtractionService:
    def __init__(self, settings: Settings, ocr_backend: OCRBackend):
        self.settings = settings
        self.ocr_backend = ocr_backend

    def extract(self, data: bytes, declared_mime_type: str) -> InvoiceExtraction:
        if not data:
            raise ValueError("The invoice document is empty")
        if len(data) > self.settings.max_document_bytes:
            raise DocumentLimitError(
                "DOCUMENT_TOO_LARGE",
                f"Document exceeds the {self.settings.max_document_bytes} byte limit",
                413,
            )
        if declared_mime_type not in SUPPORTED_MIME_TYPES:
            raise DocumentLimitError(
                "UNSUPPORTED_MEDIA_TYPE", "Use a PDF, JPEG, PNG, or WebP invoice", 415
            )
        actual_mime_type = sniff_mime(data)
        if actual_mime_type != declared_mime_type:
            raise DocumentLimitError(
                "MIME_MISMATCH",
                "Declared media type does not match the uploaded document bytes",
                415,
            )

        lines = read_document(data, actual_mime_type, self.ocr_backend, self.settings)
        text_size = sum(len(line.text) for line in lines)
        if text_size > self.settings.max_extracted_chars:
            raise DocumentLimitError(
                "DOCUMENT_TEXT_LIMIT",
                "Extracted document text exceeds the configured limit",
                413,
            )
        fields, component_items = _extract_fields(
            lines, self.settings.confidence_review_threshold
        )
        paths = _review_paths(fields, component_items)
        digest = hashlib.sha256(data).hexdigest()
        return InvoiceExtraction(
            extraction_id=uuid4(),
            document_sha256=digest,
            document_mime_type=cast(
                Literal["application/pdf", "image/jpeg", "image/png", "image/webp"],
                actual_mime_type,
            ),
            extractor=self.ocr_backend.name,
            fields=fields,
            component_items=component_items,
            review_required_paths=paths,
            integrity_signature="pending-signature",
        )


class DocumentLimitError(Exception):
    def __init__(self, code: str, message: str, status_code: int):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def _extract_fields(
    lines: list[OCRLine], threshold: float
) -> tuple[InvoiceFields, list[InvoiceLineItem]]:
    fields = InvoiceFields()
    for name in (
        "merchant",
        "invoice_number",
        "invoice_date",
        "device_model",
        "labour_charge",
        "tax",
    ):
        match = _find_labelled(lines, LABELS[name])
        if match:
            line, value, factor = match
            if name in {"labour_charge", "tax"}:
                amount = _last_amount(value)
                if amount is None:
                    continue
                value = normalize_amount(amount)
            elif name == "invoice_date":
                value = _date_candidate(value)
            elif name in {"merchant", "device_model"}:
                value = _trim_label_value(value)
            if value:
                setattr(fields, name, _field(value, line, factor, threshold))

    total_match = _find_labelled(lines, TOTAL_LABELS[0]) or _find_labelled(
        lines, TOTAL_LABELS[1]
    )
    if total_match:
        line, raw, factor = total_match
        amount = _last_amount(raw)
        if amount:
            fields.total_amount = _field(
                normalize_amount(amount), line, factor, threshold
            )

    if fields.merchant.status == "NOT_FOUND":
        merchant = _merchant_header(lines)
        if merchant:
            fields.merchant = _field(merchant.text, merchant, 0.48, threshold)

    currency = _find_currency(lines)
    if currency:
        fields.currency = _field(currency[1], currency[0], 0.92, threshold)
    return fields, _extract_component_rows(lines, threshold)


def _find_labelled(
    lines: list[OCRLine], pattern: re.Pattern[str]
) -> tuple[OCRLine, str, float] | None:
    for index, line in enumerate(lines):
        match = pattern.search(line.text)
        if not match:
            continue
        value = _trim_label_value(match.group(1))
        if not value and index + 1 < len(lines) and lines[index + 1].page == line.page:
            return lines[index + 1], lines[index + 1].text.strip(), 0.74
        if value:
            return line, value, 0.9
    return None


def _field(
    value: str, line: OCRLine, parser_factor: float, threshold: float
) -> ExtractedField:
    mean = line.mean_confidence
    base = 0.92 if line.source_kind == "EMBEDDED_PDF_TEXT" else ((mean or 0) / 100)
    score = round(min(0.99, max(0.01, base * parser_factor)), 3)
    return ExtractedField(
        value=value,
        confidence=score,
        confidence_kind="HEURISTIC_UNCALIBRATED",
        status="SUGGESTED" if score >= threshold else "NEEDS_REVIEW",
        source=_source(line),
    )


def _source(line: OCRLine) -> SourceSpan:
    return SourceSpan(
        page=line.page,
        text=line.text[:2_000],
        bounding_box=line.box,
        source_kind=line.source_kind,
    )  # type: ignore[arg-type]


def _extract_component_rows(
    lines: list[OCRLine], threshold: float
) -> list[InvoiceLineItem]:
    result: list[InvoiceLineItem] = []
    for line in lines:
        text = line.text.strip()
        if (
            not text
            or not re.search(r"[A-Za-z]{2,}", text)
            or EXCLUDED_ROW_WORDS.search(text)
        ):
            continue
        amounts = list(AMOUNT_RE.finditer(text))
        if not amounts or text[amounts[-1].end() :].strip(" \t|-"):
            continue

        description = text[: amounts[-1].start()].strip(" \t|:-")
        parser_factor = 0.68
        quantity = _not_found()
        unit_price = _not_found()

        # Explicit quantity-price notation is stronger column evidence than
        # guessing which standalone numbers are quantities or model identifiers.
        explicit = re.search(
            r"(?P<description>.+?)\s+(?P<quantity>\d{1,4}(?:[.,]\d{1,3})?)\s*[x@]\s*(?P<price>[$\u20ac\u00a3\u20b9]?\s*\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{1,2})?)$",
            text,
            re.I,
        )
        if explicit:
            description = explicit.group("description").strip(" \t|:-")
            quantity = _field(
                explicit.group("quantity").replace(",", "."), line, 0.75, threshold
            )
            unit_price = _field(
                normalize_amount(explicit.group("price")), line, 0.78, threshold
            )
            parser_factor = 0.82
        elif len(amounts) >= 3:
            qty_text = normalize_amount(amounts[-3].group(0))
            unit = normalize_amount(amounts[-2].group(0))
            line_total = normalize_amount(amounts[-1].group(0))
            if re.fullmatch(r"\d{1,4}", qty_text) and _approximately_multiplies(
                qty_text, unit, line_total
            ):
                description = text[: amounts[-3].start()].strip(" \t|:-")
                quantity = _field(qty_text, line, 0.68, threshold)
                unit_price = _field(unit, line, 0.72, threshold)
                parser_factor = 0.78
        elif len(amounts) == 2:
            qty_text = normalize_amount(amounts[-2].group(0))
            if re.fullmatch(r"\d{1,4}", qty_text):
                description = text[: amounts[-2].start()].strip(" \t|:-")
                quantity = _field(qty_text, line, 0.65, threshold)
                unit_price = _field(
                    normalize_amount(amounts[-1].group(0)), line, 0.7, threshold
                )
                parser_factor = 0.72

        if len(description) < 3 or not re.search(r"[A-Za-z]{2,}", description):
            continue
        result.append(
            InvoiceLineItem(
                component_description=_field(
                    description, line, parser_factor, threshold
                ),
                quantity=quantity,
                unit_price=unit_price,
            )
        )
        if len(result) >= 200:
            break
    return result


def _approximately_multiplies(quantity: str, unit: str, total: str) -> bool:
    try:
        return abs(Decimal(quantity) * Decimal(unit) - Decimal(total)) <= Decimal(
            "0.05"
        )
    except InvalidOperation:
        return False


def _not_found() -> ExtractedField:
    return ExtractedField(
        value=None,
        confidence=None,
        confidence_kind="NOT_APPLICABLE",
        status="NOT_FOUND",
        source=None,
    )


def _review_paths(fields: InvoiceFields, items: list[InvoiceLineItem]) -> list[str]:
    result = [
        f"fields.{name}"
        for name, value in fields
        for _ in [0]
        if value.status != "SUGGESTED"
    ]
    for index, item in enumerate(items):
        for name, value in item:
            if value.status != "SUGGESTED":
                result.append(f"component_items[{index}].{name}")
    return result


def _merchant_header(lines: list[OCRLine]) -> OCRLine | None:
    for line in lines[:5]:
        text = line.text.strip()
        if (
            len(text) >= 3
            and re.search(r"[A-Za-z]{2,}", text)
            and not re.search(r"invoice|receipt|tax|date", text, re.I)
        ):
            return line
    return None


def _find_currency(lines: list[OCRLine]) -> tuple[OCRLine, str] | None:
    patterns = [
        (r"\bUSD\b|\$", "USD"),
        (r"\bEUR\b|\u20ac", "EUR"),
        (r"\bGBP\b|\u00a3", "GBP"),
        (r"\bINR\b|\u20b9", "INR"),
        (r"\bCAD\b", "CAD"),
        (r"\bAUD\b", "AUD"),
    ]
    for line in lines:
        for pattern, value in patterns:
            if re.search(pattern, line.text, re.I):
                return line, value
    return None


def _last_amount(text: str) -> str | None:
    matches = list(AMOUNT_RE.finditer(text))
    return matches[-1].group(0).strip() if matches else None


def normalize_amount(value: str) -> str:
    value = value.strip().upper()
    value = re.sub(r"(?:USD|EUR|GBP|INR|CAD|AUD)$", "", value).strip()
    value = re.sub(r"[$\u20ac\u00a3\u20b9\u00a0 ]", "", value)
    if "," in value and "." in value:
        if value.rfind(",") > value.rfind("."):
            value = value.replace(".", "").replace(",", ".")
        else:
            value = value.replace(",", "")
    elif "," in value:
        tail = value.rsplit(",", 1)[1]
        value = value.replace(",", "." if len(tail) in (1, 2) else "")
    elif value.count(".") > 1:
        head, tail = value.rsplit(".", 1)
        value = head.replace(".", "") + ("." + tail if len(tail) in (1, 2) else tail)
    try:
        number = Decimal(value)
        if not number.is_finite():
            return value
        return format(number, "f")
    except InvalidOperation:
        return value


def _date_candidate(value: str) -> str:
    candidate = DATE_RE.search(value)
    return candidate.group(0).strip() if candidate else _trim_label_value(value)


def _trim_label_value(value: str) -> str:
    value = re.sub(r"^[\s:#|\-]+", "", value)
    return re.sub(r"\s+", " ", value).strip(" \t|:-")[:500]
