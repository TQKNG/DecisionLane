from io import BytesIO
from unittest.mock import Mock, patch

import pytest
from PIL import Image

from refundflow.services import file_validation
from refundflow.services.blob_storage import MAX_FILE_BYTES
from refundflow.services.file_validation import validate_uploaded_file


def make_png() -> bytes:
    buffer = BytesIO()

    image = Image.new("RGB", (2, 2), color="red")
    image.save(buffer, format="PNG")

    return buffer.getvalue()


def make_jpeg() -> bytes:
    buffer = BytesIO()

    image = Image.new("RGB", (2, 2), color="blue")
    image.save(buffer, format="JPEG")

    return buffer.getvalue()


def test_valid_png_is_accepted() -> None:
    content = make_png()

    result = validate_uploaded_file(content, "image/png")

    assert result == "image/png"


def test_valid_jpeg_is_accepted() -> None:
    content = make_jpeg()

    result = validate_uploaded_file(content, "image/jpeg")

    assert result == "image/jpeg"


def test_empty_file_is_rejected() -> None:
    with pytest.raises(ValueError, match="empty"):
        validate_uploaded_file(b"", "image/png")


def test_mismatched_image_signature_is_rejected() -> None:
    content = make_png()

    with pytest.raises(ValueError, match="signature"):
        validate_uploaded_file(content, "image/jpeg")


def test_invalid_pdf_signature_is_rejected() -> None:
    with pytest.raises(ValueError, match="valid PDF"):
        validate_uploaded_file(b"not-a-pdf", "application/pdf")


def test_unsupported_content_type_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        validate_uploaded_file(b"content", "text/plain")


def test_oversized_file_is_rejected() -> None:
    with pytest.raises(ValueError, match="maximum size"):
        validate_uploaded_file(b"x" * (MAX_FILE_BYTES + 1), "image/png")


def test_valid_pdf_is_accepted() -> None:
    with patch.object(file_validation.pdfium, "PdfDocument", return_value=[1]):
        assert validate_uploaded_file(b"%PDF-1.7", "application/pdf") == "application/pdf"


@pytest.mark.parametrize("page_count", [0, 3])
def test_pdf_page_count_outside_allowed_range_is_rejected(page_count: int) -> None:
    with patch.object(
        file_validation.pdfium,
        "PdfDocument",
        return_value=Mock(__len__=Mock(return_value=page_count)),
    ):
        with pytest.raises(ValueError, match="one or two pages"):
            validate_uploaded_file(b"%PDF-1.7", "application/pdf")


def test_unreadable_pdf_is_rejected() -> None:
    with patch.object(
        file_validation.pdfium,
        "PdfDocument",
        side_effect=RuntimeError("invalid PDF"),
    ):
        with pytest.raises(ValueError, match="readable PDF"):
            validate_uploaded_file(b"%PDF-1.7", "application/pdf")


def test_unreadable_image_is_rejected() -> None:
    with pytest.raises(ValueError, match="readable image"):
        validate_uploaded_file(b"not an image", "image/png")
