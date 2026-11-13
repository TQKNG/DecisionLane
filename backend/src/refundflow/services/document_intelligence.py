from __future__ import annotations

import re

import pypdfium2 as pdfium  # type: ignore[import-untyped]
from azure.ai.documentintelligence.aio import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
from azure.core.credentials_async import AsyncTokenCredential

from refundflow.domain.models import ExtractedDocument, SafetyAnalysis
from refundflow.services.file_validation import validate_uploaded_file

FIELD_ALIASES = {
    "order reference": "order_id",
    "order id": "order_id",
    "order number": "order_id",
    "purchase date": "purchase_date",
    "date": "purchase_date",
    "total": "total_amount",
    "total amount": "total_amount",
    "total paid": "total_amount",
    "currency": "currency",
}

CURRENCY_CODE_PATTERN = re.compile(r"\b(?:AUD|CAD|CHF|CNY|EUR|GBP|INR|JPY|NZD|USD)\b")


def _normalize_label(label: str) -> str:
    return " ".join(label.strip().lower().replace("_", " ").split())


def _find_currency_code(values: list[str]) -> str | None:
    for value in values:
        match = CURRENCY_CODE_PATTERN.search(value.upper())
        if match:
            return match.group(0)
    return None


def normalize_extracted_fields(
    key_values: dict[str, str],
    text: str,
) -> dict[str, str]:
    normalized: dict[str, str] = {}
    currency_candidates: list[str] = []

    for raw_key, value in key_values.items():
        canonical_key = FIELD_ALIASES.get(_normalize_label(raw_key), raw_key.strip())
        if canonical_key == "currency":
            currency_candidates.append(value)
            continue
        normalized[canonical_key] = value

    currency = _find_currency_code(currency_candidates + [text])
    if currency:
        normalized["currency"] = currency

    return normalized


def validate_file(content: bytes, content_type: str) -> int:
    validate_uploaded_file(content, content_type)

    if content_type == "application/pdf":
        document = pdfium.PdfDocument(content)
        return len(document)

    return 1

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
        raw_key_values: dict[str, str] = {}
        for pair in result.key_value_pairs or []:
            if pair.key and pair.value:
                raw_key_values[pair.key.content[:100]] = pair.value.content[:500]
        text = (result.content or "")[:20_000]
        return ExtractedDocument(
            document_id = document_id,
            file_name = file_name,
            content_type = content_type,
            page_count = page_count,
            text=text,
            key_values=normalize_extracted_fields(raw_key_values, text),
            safety=safety
        )
    
    async def close(self)-> None:
        await self._client.close()
