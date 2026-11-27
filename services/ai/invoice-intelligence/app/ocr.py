from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import csv
import math
import subprocess
from typing import Literal, Protocol

from PIL import Image, ImageOps, UnidentifiedImageError

from .config import Settings


SUPPORTED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}
SourceKind = Literal["OCR_TEXT", "EMBEDDED_PDF_TEXT"]


class DocumentError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class OCRWord:
    text: str
    confidence: float | None
    box: tuple[float, float, float, float] | None
    page: int
    block: int
    paragraph: int
    line: int
    source_kind: SourceKind


@dataclass(frozen=True)
class OCRLine:
    text: str
    words: tuple[OCRWord, ...]
    page: int
    box: tuple[float, float, float, float] | None
    source_kind: SourceKind

    @property
    def mean_confidence(self) -> float | None:
        values = [word.confidence for word in self.words if word.confidence is not None]
        return sum(values) / len(values) if values else None


class OCRBackend(Protocol):
    name: str

    def read_image(
        self, image_bytes: bytes, page: int, width: int, height: int
    ) -> list[OCRLine]: ...


class TesseractOCR:
    name = "tesseract-tsv"

    def __init__(self, settings: Settings):
        self.settings = settings

    def read_image(
        self, image_bytes: bytes, page: int, width: int, height: int
    ) -> list[OCRLine]:
        command = [
            self.settings.tesseract_command,
            "stdin",
            "stdout",
            "--psm",
            "6",
            "-l",
            self.settings.ocr_languages,
            "tsv",
        ]
        try:
            completed = subprocess.run(
                command,
                input=image_bytes,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=self.settings.ocr_timeout_seconds,
                check=False,
            )
        except FileNotFoundError as exc:
            raise DocumentError(
                "OCR_ENGINE_UNAVAILABLE",
                "The OCR engine is not installed or configured",
                503,
            ) from exc
        except subprocess.TimeoutExpired as exc:
            raise DocumentError(
                "OCR_TIMEOUT", "Document OCR exceeded the processing time limit", 503
            ) from exc

        if completed.returncode != 0:
            detail = completed.stderr.decode("utf-8", errors="replace")[:300]
            raise DocumentError(
                "OCR_FAILED",
                f"The OCR engine could not process this page: {detail}",
                422,
            )
        return _parse_tsv(
            completed.stdout.decode("utf-8", errors="replace"), page, width, height
        )


def sniff_mime(data: bytes) -> str | None:
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def preprocess_image(
    data: bytes, settings: Settings
) -> tuple[bytes, int, int, float, float]:
    try:
        with Image.open(BytesIO(data)) as opened:
            if opened.format not in {"JPEG", "PNG", "WEBP"}:
                raise DocumentError(
                    "UNSUPPORTED_IMAGE",
                    "Only JPEG, PNG, and WebP invoices are supported",
                    415,
                )
            width, height = opened.size
            if (
                width <= 0
                or height <= 0
                or width * height > settings.max_pixels_per_page
            ):
                raise DocumentError(
                    "IMAGE_DIMENSIONS_LIMIT",
                    "Image dimensions exceed the configured processing limit",
                    413,
                )
            opened.verify()
        with Image.open(BytesIO(data)) as opened:
            opened.seek(0)
            original_width, original_height = opened.size
            scale = min(
                settings.max_image_upscale,
                max(1.0, 1600 / max(original_width, original_height)),
                math.sqrt(
                    settings.max_pixels_per_page / (original_width * original_height)
                ),
            )
            new_size = (
                max(1, int(original_width * scale)),
                max(1, int(original_height * scale)),
            )
            gray = ImageOps.grayscale(opened.convert("RGB"))
            if new_size != gray.size:
                gray = gray.resize(new_size, Image.Resampling.LANCZOS)
            processed = ImageOps.autocontrast(gray, cutoff=1)
            output = BytesIO()
            processed.save(output, format="PNG", optimize=True)
            return (
                output.getvalue(),
                original_width,
                original_height,
                new_size[0] / original_width,
                new_size[1] / original_height,
            )
    except DocumentError:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise DocumentError(
            "INVALID_IMAGE", "The uploaded image is corrupt or cannot be decoded", 422
        ) from exc


def read_document(
    data: bytes, mime_type: str, backend: OCRBackend, settings: Settings
) -> list[OCRLine]:
    if mime_type == "application/pdf":
        return _read_pdf(data, backend, settings)
    return _read_image(data, backend, settings)


def _read_image(data: bytes, backend: OCRBackend, settings: Settings) -> list[OCRLine]:
    processed, width, height, scale_x, scale_y = preprocess_image(data, settings)
    lines = backend.read_image(
        processed, 1, round(width * scale_x), round(height * scale_y)
    )
    return _restore_box_scale(lines, scale_x, scale_y)


def _read_pdf(data: bytes, backend: OCRBackend, settings: Settings) -> list[OCRLine]:
    try:
        import pymupdf
    except ImportError as exc:
        raise DocumentError(
            "PDF_ENGINE_UNAVAILABLE",
            "PDF support is not installed in this service",
            503,
        ) from exc

    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise DocumentError(
            "INVALID_PDF", "The uploaded PDF is corrupt or cannot be opened", 422
        ) from exc

    with document:
        if document.needs_pass:
            raise DocumentError(
                "ENCRYPTED_PDF", "Encrypted PDFs are not supported", 422
            )
        if document.page_count < 1 or document.page_count > settings.max_pdf_pages:
            raise DocumentError(
                "PDF_PAGE_LIMIT",
                f"PDFs must contain between 1 and {settings.max_pdf_pages} pages",
                413,
            )
        result: list[OCRLine] = []
        for page_number, page in enumerate(document, start=1):
            native_lines = _native_pdf_lines(page, page_number)
            if native_lines and sum(len(line.text) for line in native_lines) >= 20:
                result.extend(native_lines)
                continue
            width_points, height_points = (
                float(page.rect.width),
                float(page.rect.height),
            )
            if width_points <= 0 or height_points <= 0:
                raise DocumentError(
                    "INVALID_PDF_PAGE", "PDF contains an invalid page size", 422
                )
            scale = min(
                2.0,
                math.sqrt(
                    settings.max_pixels_per_page / (width_points * height_points)
                ),
            )
            if scale < 0.5:
                raise DocumentError(
                    "PDF_PAGE_DIMENSIONS_LIMIT",
                    "PDF page dimensions exceed the configured processing limit",
                    413,
                )
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
            if pixmap.width * pixmap.height > settings.max_pixels_per_page:
                raise DocumentError(
                    "PDF_PAGE_DIMENSIONS_LIMIT",
                    "Rendered PDF page exceeds the configured processing limit",
                    413,
                )
            source = Image.open(BytesIO(pixmap.tobytes("png")))
            gray = ImageOps.autocontrast(ImageOps.grayscale(source), cutoff=1)
            image_bytes = BytesIO()
            gray.save(image_bytes, format="PNG", optimize=True)
            page_lines = backend.read_image(
                image_bytes.getvalue(), page_number, pixmap.width, pixmap.height
            )
            result.extend(page_lines)
        return result


def _native_pdf_lines(page, page_number: int) -> list[OCRLine]:
    words = page.get_text("words", sort=True)
    grouped: dict[tuple[int, int, int], list[OCRWord]] = {}
    page_width, page_height = float(page.rect.width), float(page.rect.height)
    for item in words:
        x0, y0, x1, y1, text, block, line, word_index = item[:8]
        if not text or not text.strip():
            continue
        box = (x0 / page_width, y0 / page_height, x1 / page_width, y1 / page_height)
        token = OCRWord(
            text, 98.0, box, page_number, int(block), 0, int(line), "EMBEDDED_PDF_TEXT"
        )
        grouped.setdefault((int(block), int(line), 0), []).append(token)
    return [
        _line_from_words(tokens, "EMBEDDED_PDF_TEXT") for tokens in grouped.values()
    ]


def _parse_tsv(
    tsv: str, page: int, image_width: int, image_height: int
) -> list[OCRLine]:
    reader = csv.DictReader(tsv.splitlines(), delimiter="\t")
    grouped: dict[tuple[int, int, int], list[OCRWord]] = {}
    for row in reader:
        text = (row.get("text") or "").strip()
        if not text:
            continue
        try:
            conf = float(row.get("conf", "-1"))
            x, y, width, height = (
                int(row[key]) for key in ("left", "top", "width", "height")
            )
            block, paragraph, line = (
                int(row.get(key, "0")) for key in ("block_num", "par_num", "line_num")
            )
        except (TypeError, ValueError, KeyError):
            continue
        if conf < 0:
            continue
        box = (
            x / image_width,
            y / image_height,
            (x + width) / image_width,
            (y + height) / image_height,
        )
        word = OCRWord(
            text,
            max(0.0, min(100.0, conf)),
            box,
            page,
            block,
            paragraph,
            line,
            "OCR_TEXT",
        )
        grouped.setdefault((block, paragraph, line), []).append(word)
    return [_line_from_words(words, "OCR_TEXT") for words in grouped.values()]


def _line_from_words(words: list[OCRWord], source_kind: SourceKind) -> OCRLine:
    ordered = tuple(words)
    boxes = [word.box for word in ordered if word.box is not None]
    box = None
    if boxes:
        box = (
            min(b[0] for b in boxes),
            min(b[1] for b in boxes),
            max(b[2] for b in boxes),
            max(b[3] for b in boxes),
        )
    return OCRLine(
        " ".join(word.text for word in ordered),
        ordered,
        ordered[0].page,
        box,
        source_kind,
    )


def _restore_box_scale(
    lines: list[OCRLine], scale_x: float, scale_y: float
) -> list[OCRLine]:
    # The TSV coordinates are normalized to the processed page dimensions; the values
    # remain normalized after an upscale, so no coordinate transform is required.
    del scale_x, scale_y
    return lines
