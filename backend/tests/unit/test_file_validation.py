from io import BytesIO

import pytest
from PIL import Image

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
