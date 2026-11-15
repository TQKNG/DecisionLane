from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

from refundflow.services import blob_storage
from refundflow.services.blob_storage import BlobStorageService


@pytest.mark.asyncio
async def test_create_upload_url_returns_blob_path_and_sas() -> None:
    blob = SimpleNamespace(url="https://storage.example.test/blob")
    client = SimpleNamespace(
        get_user_delegation_key=AsyncMock(return_value="delegation-key"),
        get_blob_client=Mock(return_value=blob),
    )
    credential = AsyncMock()

    with (
        patch.object(blob_storage, "BlobServiceClient", return_value=client),
        patch.object(blob_storage, "generate_blob_sas", return_value="sas-token"),
    ):
        service = BlobStorageService(
            "account",
            "https://storage.example.test",
            credential,
            "quarantine",
        )
        document_id, blob_name, upload_url = await service.create_upload_url(
            "customer-1",
            "claim-1",
            "image/png",
        )

    assert blob_name == f"customer-1/claim-1/{document_id}.png"
    assert upload_url == "https://storage.example.test/blob?sas-token"
    client.get_user_delegation_key.assert_awaited_once()
    client.get_blob_client.assert_called_once_with("quarantine", blob_name)


@pytest.mark.asyncio
async def test_create_upload_url_rejects_unsupported_content_type() -> None:
    service = BlobStorageService.__new__(BlobStorageService)

    with pytest.raises(ValueError, match="Only PDF"):
        await service.create_upload_url("customer-1", "claim-1", "text/plain")


@pytest.mark.asyncio
async def test_blob_properties_and_download_are_forwarded() -> None:
    properties = SimpleNamespace(size=4)
    downloader = SimpleNamespace(readall=AsyncMock(return_value=b"data"))
    blob = SimpleNamespace(
        get_blob_properties=AsyncMock(return_value=properties),
        download_blob=AsyncMock(return_value=downloader),
    )
    client = SimpleNamespace(get_blob_client=Mock(return_value=blob))
    service = BlobStorageService.__new__(BlobStorageService)
    service._container = "quarantine"
    service._client = client

    assert await service.get_blob_properties("file.png") is properties
    assert await service.download_content("file.png") == b"data"
    client.get_blob_client.assert_called_with("quarantine", "file.png")
    blob.download_blob.assert_awaited_once_with(max_concurrency=1)
    downloader.readall.assert_awaited_once()
