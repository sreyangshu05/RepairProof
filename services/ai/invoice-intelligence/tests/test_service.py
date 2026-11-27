from __future__ import annotations

from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.extraction import InvoiceExtractionService
from app.main import create_app
from app.ocr import OCRLine, OCRWord, _parse_tsv, preprocess_image


class FixtureOCR:
    name = "fixture-ocr"

    def read_image(
        self, image_bytes: bytes, page: int, width: int, height: int
    ) -> list[OCRLine]:
        texts = [
            "Repair Shop Co",
            "Invoice No: INV-42",
            "Invoice Date: 12 February 2026",
            "Device Model: iPhone 15 Pro",
            "Screen Assembly 1 x $89.00",
            "Labour Charge: $45.00",
            "GST: $10.72",
            "Grand Total: $144.72",
        ]
        return [
            OCRLine(
                text=text,
                words=(
                    OCRWord(
                        text, 96.0, (0.1, 0.1, 0.9, 0.2), page, 1, 1, index, "OCR_TEXT"
                    ),
                ),
                page=page,
                box=(0.1, 0.1, 0.9, 0.2),
                source_kind="OCR_TEXT",
            )
            for index, text in enumerate(texts)
        ]


def png_document() -> bytes:
    output = BytesIO()
    Image.new("RGB", (400, 600), "white").save(output, format="PNG")
    return output.getvalue()


def setup_client(max_bytes: int = 1_000_000) -> tuple[TestClient, Settings]:
    settings = Settings(
        internal_api_token="test-internal-token-long-enough-123456",
        extraction_signing_secret="test-signing-secret-long-enough-123456",
        max_document_bytes=max_bytes,
    )
    service = InvoiceExtractionService(settings, FixtureOCR())
    return TestClient(create_app(settings, service)), settings


def auth() -> dict[str, str]:
    return {"Authorization": "Bearer test-internal-token-long-enough-123456"}


def test_extracts_structured_candidates_without_verifying_them() -> None:
    client, _ = setup_client()
    response = client.post(
        "/v1/invoices/extract",
        headers=auth(),
        files={"file": ("invoice.png", png_document(), "image/png")},
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["fields"]["merchant"]["value"] == "Repair Shop Co"
    assert result["fields"]["invoice_number"]["value"] == "INV-42"
    assert result["fields"]["invoice_date"]["value"] == "12 February 2026"
    assert result["fields"]["device_model"]["value"] == "iPhone 15 Pro"
    assert result["fields"]["labour_charge"]["value"] == "45.00"
    assert result["fields"]["tax"]["value"] == "10.72"
    assert result["fields"]["total_amount"]["value"] == "144.72"
    assert (
        result["component_items"][0]["component_description"]["value"]
        == "Screen Assembly"
    )
    assert result["component_items"][0]["quantity"]["value"] == "1"
    assert result["component_items"][0]["unit_price"]["value"] == "89.00"
    assert result["review_status"] == "PENDING_HUMAN_REVIEW"
    assert result["confidence_policy"] == "HEURISTIC_UNCALIBRATED"
    assert all(
        value["status"] in {"SUGGESTED", "NEEDS_REVIEW", "NOT_FOUND"}
        for value in result["fields"].values()
    )
    assert "independently_verified" not in result
    assert len(result["document_sha256"]) == 64
    assert len(result["integrity_signature"]) == 64


def test_rejects_unauthenticated_request_and_mime_spoof() -> None:
    client, _ = setup_client()
    unauthenticated = client.post(
        "/v1/invoices/extract", files={"file": ("a.png", png_document(), "image/png")}
    )
    assert unauthenticated.status_code == 401
    spoofed = client.post(
        "/v1/invoices/extract",
        headers=auth(),
        files={"file": ("a.pdf", png_document(), "application/pdf")},
    )
    assert spoofed.status_code == 415
    assert spoofed.json()["error"]["code"] == "MIME_MISMATCH"


def test_rejects_over_limit_upload_before_ocr() -> None:
    document = png_document()
    client, _ = setup_client(max_bytes=len(document) - 1)
    response = client.post(
        "/v1/invoices/extract",
        headers=auth(),
        files={"file": ("a.png", document, "image/png")},
    )
    assert response.status_code == 413


def test_rejects_corrupt_image_with_supported_signature() -> None:
    client, _ = setup_client()
    corrupt_png = b"\x89PNG\r\n\x1a\n" + b"not-a-real-png"
    response = client.post(
        "/v1/invoices/extract",
        headers=auth(),
        files={"file": ("broken.png", corrupt_png, "image/png")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_IMAGE"


def test_correction_requires_backend_reviewer_and_records_nonverified_receipt() -> None:
    client, settings = setup_client()
    extracted = client.post(
        "/v1/invoices/extract",
        headers=auth(),
        files={"file": ("invoice.png", png_document(), "image/png")},
    ).json()
    missing_identity = client.post(
        "/v1/invoices/corrections",
        headers={**auth(), "Idempotency-Key": "review-00001"},
        json={
            "extraction": extracted,
            "corrections": {"fields.merchant": "Repair Shop Limited"},
        },
    )
    assert missing_identity.status_code == 401

    response = client.post(
        "/v1/invoices/corrections",
        headers={
            **auth(),
            "X-RepairProof-Reviewer-Id": "profile-123",
            "Idempotency-Key": "review-00001",
        },
        json={
            "extraction": extracted,
            "corrections": {"fields.merchant": "Repair Shop Limited"},
        },
    )
    assert response.status_code == 200, response.text
    receipt = response.json()
    assert receipt["reviewer_profile_id"] == "profile-123"
    assert receipt["corrections"][0]["previous_suggestion"] == "Repair Shop Co"
    assert receipt["corrections"][0]["corrected_value"] == "Repair Shop Limited"
    assert receipt["corrections"][0]["confidence"] is None
    assert receipt["corrections"][0]["independently_verified"] is False
    assert receipt["independently_verified"] is False

    extracted["fields"]["merchant"]["value"] = "tampered"
    tampered = client.post(
        "/v1/invoices/corrections",
        headers={
            **auth(),
            "X-RepairProof-Reviewer-Id": "profile-123",
            "Idempotency-Key": "review-00002",
        },
        json={
            "extraction": extracted,
            "corrections": {"fields.merchant": "Repair Shop Limited"},
        },
    )
    assert tampered.status_code == 409
    assert settings.extraction_signing_secret


def test_correction_rejects_unknown_paths_and_requires_idempotency_key() -> None:
    client, _ = setup_client()
    extracted = client.post(
        "/v1/invoices/extract",
        headers=auth(),
        files={"file": ("invoice.png", png_document(), "image/png")},
    ).json()
    headers = {**auth(), "X-RepairProof-Reviewer-Id": "profile-123"}
    no_key = client.post(
        "/v1/invoices/corrections",
        headers=headers,
        json={"extraction": extracted, "corrections": {"fields.merchant": "Shop"}},
    )
    assert no_key.status_code == 400
    invalid_path = client.post(
        "/v1/invoices/corrections",
        headers={**headers, "Idempotency-Key": "review-00003"},
        json={
            "extraction": extracted,
            "corrections": {"fields.review_status": "COMPLETED"},
        },
    )
    assert invalid_path.status_code == 422


def test_health_and_documentation_are_available() -> None:
    client, _ = setup_client()
    assert client.get("/health/live").json() == {"status": "alive"}
    assert client.get("/health/ready").json()["status"] == "ready"
    assert client.get("/openapi.json").status_code == 200
    assert client.get("/docs").status_code == 200


def test_tsv_ocr_groups_words_and_returns_normalized_source_boxes() -> None:
    tsv = (
        "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
        "5\t1\t1\t1\t1\t1\t10\t20\t40\t12\t96.0\tInvoice\n"
        "5\t1\t1\t1\t1\t2\t55\t20\t25\t12\t90.0\t42\n"
    )
    lines = _parse_tsv(tsv, page=1, image_width=100, image_height=100)
    assert len(lines) == 1
    assert lines[0].text == "Invoice 42"
    assert lines[0].mean_confidence == 93
    assert lines[0].box == (0.1, 0.2, 0.8, 0.32)


def test_image_preprocessing_enforces_dimensions_and_normalizes_image() -> None:
    image = Image.new("RGB", (120, 80), (230, 230, 230))
    output = BytesIO()
    image.save(output, format="JPEG")
    processed, width, height, scale_x, scale_y = preprocess_image(
        output.getvalue(), Settings(max_pixels_per_page=20_000)
    )
    assert (width, height) == (120, 80)
    assert scale_x <= 2 and scale_y <= 2
    with Image.open(BytesIO(processed)) as result:
        assert result.mode == "L"
        assert result.format == "PNG"
        assert result.width * result.height <= 20_000

    oversized = BytesIO()
    Image.new("RGB", (200, 200), "white").save(oversized, format="PNG")
    # Exercise the same validation boundary used for uploaded raster images.
    from app.ocr import DocumentError, preprocess_image as preprocess
    import pytest

    with pytest.raises(DocumentError) as error:
        preprocess(oversized.getvalue(), Settings(max_pixels_per_page=10_000))
    assert error.value.code == "IMAGE_DIMENSIONS_LIMIT"
