from __future__ import annotations

from io import BytesIO

import pypdfium2 as pdfium  # type: ignore[import-untyped]
from PIL import Image

from refundflow.services.blob_storage import MAX_FILE_BYTES

IMAGE_FORMATS = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def validate_uploaded_file(
    content: bytes,
    declared_content_type: str,
) -> str:
    """Validate bytes and return the detected MIME type."""

    if not content:
        raise ValueError("Uploaded file is empty")

    if len(content) > MAX_FILE_BYTES:
        raise ValueError("Uploaded file exceeds the maximum size")

    if declared_content_type == "application/pdf":
        if not content.startswith(b"%PDF"):
            raise ValueError("Uploaded file is not a valid PDF")

        try:
            document = pdfium.PdfDocument(content)
            page_count = len(document)
        except Exception as exc:
            raise ValueError("Uploaded file is not a readable PDF") from exc

        if page_count < 1 or page_count > 2:
            raise ValueError("PDF files must contain one or two pages")

        return "application/pdf"

    if declared_content_type not in {
        "image/jpeg",
        "image/png",
        "image/webp",
    }:
        raise ValueError("Unsupported uploaded content type")

    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
            detected_content_type = IMAGE_FORMATS.get(image.format or "")
    except Exception as exc:
        raise ValueError("Uploaded file is not a readable image") from exc

    if detected_content_type != declared_content_type:
        raise ValueError("Uploaded file signature does not match content type")

    return detected_content_type
