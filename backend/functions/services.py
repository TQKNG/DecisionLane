from __future__ import annotations

from collections.abc import Awaitable, Callable

from azure.identity.aio import DefaultAzureCredential

from refundflow.config import get_settings
from refundflow.repositories.cosmos import CosmosClaimRepository
from refundflow.services.content_safety import ContentSafetyService
from refundflow.services.content_understanding import (
    ContentUnderstandingService,
)
from refundflow.services.document_intelligence import DocumentExtractionService
from refundflow.services.embeddings import EmbeddingService
from refundflow.services.evidence_storage import EvidenceStorageService
from refundflow.services.malware import MalwareScanService
from refundflow.services.policy_search import PolicySearchService


class ActivityServices:
    def __init__(self)-> None:
        settings = get_settings()
        self.settings = settings
        self.credential = DefaultAzureCredential()
        self.repository = CosmosClaimRepository(
            settings.cosmos_endpoint,
            settings.cosmos_database,
            self.credential
        )
        self.malware = MalwareScanService(
            settings.storage_account_url,
            settings.quarantine_container,
            self.credential
        )
        self.content_safety = ContentSafetyService(
            settings.content_safety_endpoint, 
            settings.content_safety_api_version,
            self.credential
        )
        self.extraction = DocumentExtractionService(
            settings.document_intelligence_endpoint,
            self.credential
        )
        self.content_understanding = ContentUnderstandingService(
            settings.content_understanding_endpoint,
            settings.content_understanding_document_analyzer_id,
            settings.content_understanding_image_analyzer_id,
            settings.content_understanding_api_version,
            self.credential,
        )
        self.evidence_storage = EvidenceStorageService(
            settings.storage_account_url,
            self.credential, 
            settings.quarantine_container,
            settings.evidence_container
        )
        embedding_service = EmbeddingService(
            settings.foundry_resource_endpoint,
            settings.foundry_embedding_model,
            self.credential
        )
        self.policy_search=PolicySearchService(
            settings.azure_search_endpoint,
            settings.azure_search_index,
            settings.azure_search_query_key,
            embedding_service
        )

    async def close(self) -> None:
        errors: list[Exception] = []
        close_operations: list[Callable[[], Awaitable[None]]] = [
            self.policy_search.close,
            self.evidence_storage.close,
            self.malware.close,
            self.content_safety.close,
            self.extraction.close,
            self.content_understanding.close,
            self.repository.close,
        ]
        for close in close_operations:
            try:
                await close()
            except Exception as exc:
                errors.append(exc)
        try:
            await self.credential.close()
        except Exception as exc:
            errors.append(exc)
        if errors:
            raise ExceptionGroup("Failed to close activity service clients", errors)
