from __future__ import annotations

from typing import Any

from azure.ai.contentunderstanding.aio import ContentUnderstandingClient
from azure.core.credentials_async import AsyncTokenCredential
from pydantic import ValidationError

from refundflow.domain.models import EvidenceClassification, EvidenceType


class ContentUnderstandingService:
    def __init__(
        self,
        endpoint: str,
        document_analyzer_id: str,
        image_analyzer_id: str,
        api_version: str,
        credential: AsyncTokenCredential,
    ) -> None:
        self._document_analyzer_id = document_analyzer_id
        self._image_analyzer_id = image_analyzer_id
        self._client = ContentUnderstandingClient(
            endpoint=endpoint,
            credential=credential,
            api_version=api_version,
        )

    def _select_analyzer(self, content_type: str) -> str:
        if content_type.startswith("image/"):
            return self._image_analyzer_id

        if content_type == "application/pdf":
            return self._document_analyzer_id

        raise ValueError(f"Unsupported Content Understanding type: {content_type}")

    @staticmethod
    def _field_value(field: Any) -> Any:
        for attribute_name in (
            "value_string",
            "value_boolean",
            "value_number",
            "value_integer",
        ):
            value = getattr(field, attribute_name, None)
            if value is not None:
                return value

        return None

    async def analyze(
        self,
        content: bytes,
        content_type: str,
        ) -> EvidenceClassification:
        analyzer_id = self._select_analyzer(content_type)

        poller = await self._client.begin_analyze_binary(
            analyzer_id=analyzer_id,
            binary_input=content,
            content_type=content_type,
        )
        result = await poller.result()

        if not result.contents:
            raise ValueError("Content Understanding returned no content")

        fields = result.contents[0].fields or {}
        values = {
            name: self._field_value(field)
            for name, field in fields.items()
        }

        try:
            return EvidenceClassification.model_validate(
                {
                    "evidence_type": values.get("evidence_type"),
                    "confidence": values.get("confidence"),
                    "image_quality": values.get("image_quality", "unreadable"),
                    "shows_product": values.get("shows_product"),
                    "damage_visible": values.get("damage_visible"),
                    "damage_type": values.get("damage_type"),
                    "reason": values.get("reason") or "No reason returned.",
                    "validation_status": "classified",
                    "analyzer_id": analyzer_id,
                }
            )
        except ValidationError as exc:
            raise ValueError(
                "Content Understanding returned an invalid classification"
            ) from exc


    async def close(self) -> None:
        await self._client.close()