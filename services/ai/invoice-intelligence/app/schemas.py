from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


FieldStatus = Literal["SUGGESTED", "NEEDS_REVIEW", "NOT_FOUND"]


class SourceSpan(BaseModel):
    page: int = Field(ge=1)
    text: str = Field(max_length=2_000)
    # Normalized coordinates: left, top, right, bottom in the source page/image.
    bounding_box: tuple[float, float, float, float] | None = None
    source_kind: Literal["OCR_TEXT", "EMBEDDED_PDF_TEXT"]


class ExtractedField(BaseModel):
    value: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    confidence_kind: Literal["HEURISTIC_UNCALIBRATED", "NOT_APPLICABLE"] = (
        "NOT_APPLICABLE"
    )
    status: FieldStatus = "NOT_FOUND"
    source: SourceSpan | None = None


class InvoiceFields(BaseModel):
    merchant: ExtractedField = Field(default_factory=ExtractedField)
    invoice_number: ExtractedField = Field(default_factory=ExtractedField)
    invoice_date: ExtractedField = Field(default_factory=ExtractedField)
    device_model: ExtractedField = Field(default_factory=ExtractedField)
    labour_charge: ExtractedField = Field(default_factory=ExtractedField)
    tax: ExtractedField = Field(default_factory=ExtractedField)
    total_amount: ExtractedField = Field(default_factory=ExtractedField)
    currency: ExtractedField = Field(default_factory=ExtractedField)


class InvoiceLineItem(BaseModel):
    component_description: ExtractedField
    quantity: ExtractedField
    unit_price: ExtractedField


class InvoiceExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extraction_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    document_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    document_mime_type: Literal[
        "application/pdf", "image/jpeg", "image/png", "image/webp"
    ]
    extractor: str
    review_status: Literal["PENDING_HUMAN_REVIEW"] = "PENDING_HUMAN_REVIEW"
    confidence_policy: Literal["HEURISTIC_UNCALIBRATED"] = "HEURISTIC_UNCALIBRATED"
    fields: InvoiceFields
    component_items: list[InvoiceLineItem] = Field(default_factory=list, max_length=200)
    review_required_paths: list[str] = Field(default_factory=list, max_length=500)
    integrity_signature: str
    notice: str = (
        "Extracted values are unconfirmed suggestions. They do not establish invoice authenticity, "
        "part provenance, or the truth of a repair record."
    )


class CorrectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extraction: InvoiceExtraction
    corrections: dict[str, str | None] = Field(min_length=1, max_length=500)
    note: str | None = Field(default=None, max_length=2_000)


class CorrectionEntry(BaseModel):
    field_path: str
    previous_suggestion: str | None
    corrected_value: str | None
    source: Literal["HUMAN_ENTERED"] = "HUMAN_ENTERED"
    status: Literal["HUMAN_CORRECTED"] = "HUMAN_CORRECTED"
    confidence: None = None
    independently_verified: Literal[False] = False


class CorrectionReceipt(BaseModel):
    correction_id: UUID
    extraction_id: UUID
    document_sha256: str
    reviewer_profile_id: str
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    note: str | None = None
    corrections: list[CorrectionEntry]
    review_status: Literal["CORRECTIONS_RECORDED"] = "CORRECTIONS_RECORDED"
    independently_verified: Literal[False] = False
    notice: str = (
        "This receipt records human-entered corrections to extraction suggestions. "
        "It does not independently verify the invoice or its contents. Persist it in the authorized RepairProof system of record."
    )
