from __future__ import annotations

from io import BytesIO

import pypdfium2 as pdfium
from azure.ai.documentintelligence.aio import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
from azure.core.credentials_async import AsyncTokenCredential
from PIL import Image

from refundflow.domain.models import ExtractedDocument, SafetyAnalysis


def validate_file(content:bytes, content_type:str) -> int:
    if len(content) > 4*1024*1024:
        raise ValueError("File exceeds the 4MB limit")
    if content_type == "application/pdf":
        if not content.startswith(b"%PDF"):
            raise ValueError("File content is not a PDF")
        document = pdfium.PdfDocument(content)
        page_count = len(document)
        if page_count <1 or page_count >2:
            raise ValueError("PDF files must contain one or two pages")
        return page_count
    if content_type in {"image/jpeg", "image/png", "image/webp"}:
        with Image.open(BytesIO(content))as image:
            image.verify()
        return 1
    raise ValueError("Unsupported content type")

class DocumentExtractionService:
    def __init__(self, endpoint: str, credential: AsyncTokenCredential) -> None:
        self._client = DocumentIntelligenceClient(endpoint, credential)

    async def extract(
        self,
        document_id:str,
        file_name:str,
        content_type:str,
        content: bytes,
        safety: SafetyAnalysis
    )->ExtractedDocument:
        page_count = validate_file(content, content_type)
        poller = await self._client.begin_analyze_document(
            "prebuilt-layout",
            body=AnalyzeDocumentRequest(bytes_source=content)
        )
        result = await poller.result()
        key_values: dict[str, str] = {}
        for pair in result.key_value_pairs or []:
            if pair.key and pair.value:
                key_values[pair.key.content[:100]] = pair.value.content[:500]
        return ExtractedDocument(
            document_id = document_id,
            file_name = file_name,
            content_type = content_type,
            page_count = page_count,
            text = (result.content or "")[:20_000],
            key_values=key_values,
            safety=safety
        )
    
    async def close(self)-> None:
        await self._client.close()