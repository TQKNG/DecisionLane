from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from azure.core.credentials_async import AsyncTokenCredential
from azure.storage.blob import BlobProperties, BlobSasPermissions, generate_blob_sas
from azure.storage.blob.aio import BlobServiceClient

ALLOWED_CONTENT_TYPES={
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_FILE_BYTES = 4 *1024 * 1024  # 4MB
MAX_FILES_PER_CLAIM = 5


class BlobStorageService:
    def __init__(
        self,
        account_name: str,
        account_url: str,
        credential: AsyncTokenCredential,
        quarantine_container: str
    )-> None:
        self._account_name = account_name
        self._credential = credential
        self._container = quarantine_container
        self._client = BlobServiceClient(account_url, credential=credential)

    async def create_upload_url(
        self,
        customer_id: str,
        claim_id: str,
        content_type: str,)-> tuple[str,str,str]:
        extension = ALLOWED_CONTENT_TYPES.get(content_type)
        if extension is None:
            raise ValueError("Only PDF, JPEG, PNG, and WebP files are allowed")
        document_id = str(uuid4())
        blob_name = blob_name = f"{customer_id}/{claim_id}/{document_id}{extension}"
        start = datetime.now(UTC) - timedelta(minutes=5)
        expiry = datetime.now(UTC) + timedelta(minutes=15)
        delegation_key = await self._client.get_user_delegation_key(start, expiry)
        sas = generate_blob_sas(
            account_name=self._account_name,
            container_name=self._container,
            blob_name=blob_name,
            user_delegation_key=delegation_key,
            permission=BlobSasPermissions(create=True, write=True),
            start=start,
            expiry=expiry,
        )
        url = self._client.get_blob_client(self._container, blob_name).url
        return document_id, blob_name, f"{url}?{sas}"

    async def get_blob_properties(self, blob_name: str) -> BlobProperties:
        return await self._client.get_blob_client(
            self._container,
            blob_name,
        ).get_blob_properties()