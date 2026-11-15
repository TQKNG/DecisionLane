from __future__ import annotations

from azure.core.credentials_async import AsyncTokenCredential
from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient


class EvidenceStorageService:
    def __init__(
        self,
        account_url: str,
        credential: AsyncTokenCredential,
        quarantine_container:str,
        evidence_container:str
    )-> None:
        self._client = BlobServiceClient(account_url, credential=credential)
        self._quarantine = quarantine_container
        self._evidence = evidence_container

    async def download_quarantined(self, blob_name:str)->bytes:
        try:
            downloader = await self._client.get_blob_client(
                self._quarantine,
                blob_name
            ).download_blob(max_concurrency=1)
        except ResourceNotFoundError:
            downloader = await self._client.get_blob_client(
                self._evidence,
                blob_name,
            ).download_blob(max_concurrency=1)
        return await downloader.readall()

    async def download_evidence(self, blob_name: str) -> bytes:
        downloader = await self._client.get_blob_client(
            self._evidence,
            blob_name,
        ).download_blob(max_concurrency=1)
        return await downloader.readall()

    async def promote(self, blob_name:str, content:bytes, content_type:str)-> None:
        target = self._client.get_blob_client(self._evidence, blob_name)
        try:
            await target.get_blob_properties()
        except ResourceNotFoundError:
            await target.upload_blob(
                content,
                overwrite=False,
                content_settings=ContentSettings(content_type=content_type)
            )
        try:
            await self._client.get_blob_client(self._quarantine, blob_name).delete_blob()
        except ResourceNotFoundError:
            pass

    async def close(self) -> None:
        await self._client.close()
