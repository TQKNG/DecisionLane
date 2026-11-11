from types import SimpleNamespace

from io import BytesIO

from PIL import Image

import pytest
from fastapi import HTTPException

from api.auth import CurrentUser
from api.routers.uploads import complete_upload
from refundflow.domain.models import (
    ClaimAggregateItem,
    ClaimDocument,
    RefundClaim,
    UploadVerificationStatus,
)


def make_png() -> bytes:
    buffer = BytesIO()
    image = Image.new("RGB", (2, 2), color="red")
    image.save(buffer, format="PNG")
    return buffer.getvalue()

class FakeClaimRepository:
    def __init__(
        self,
        claim: RefundClaim,
        document: ClaimDocument,
    ) -> None:
        self.claim = claim
        self.items = [
            ClaimAggregateItem(
                id=f"document:{document.id}",
                claim_id=claim.id,
                item_type="document",
                payload=document.model_dump(mode="json"),
            )
        ]

    async def get_claim(self, claim_id: str) -> RefundClaim | None:
        if claim_id == self.claim.id:
            return self.claim.model_copy(deep=True)

        return None

    async def list_items(
        self,
        claim_id: str,
        item_type: str | None = None,
    ) -> list[ClaimAggregateItem]:
        return [
            item.model_copy(deep=True)
            for item in self.items
            if item.claim_id == claim_id
            and (item_type is None or item.item_type == item_type)
        ]

    async def upsert_item(self, item: ClaimAggregateItem) -> None:
        self.items = [
            existing
            for existing in self.items
            if existing.id != item.id
        ]
        self.items.append(item.model_copy(deep=True))


class FakeBlobService:
    def __init__(
        self,
        content: bytes,
        content_type: str,
    ) -> None:
        self.content = content
        self.content_type = content_type
        self.download_count = 0

    async def get_blob_properties(
        self,
        blob_name: str,
    ) -> SimpleNamespace:
        return SimpleNamespace(
            size=len(self.content),
            content_settings=SimpleNamespace(
                content_type=self.content_type,
            ),
        )

    async def download_content(self, blob_name: str) -> bytes:
        self.download_count += 1
        return self.content


def make_claim() -> RefundClaim:
    return RefundClaim(
        id="claim-1",
        customer_id="customer-1",
        customer_email="customer@example.com",
        order_id="order-1",
        claim_type="damaged_item",
        reason="The item arrived damaged.",
        requested_amount="10.00",
        currency="CAD",
    )


def make_document(content: bytes) -> ClaimDocument:
    return ClaimDocument(
        id="document-1",
        claim_id="claim-1",
        file_name="evidence.png",
        content_type="image/png",
        size_bytes=len(content),
        blob_name="customer-1/claim-1/document-1.png",
    )


@pytest.mark.asyncio
async def test_complete_upload_marks_document_verified() -> None:
    content = make_png()
    claim = make_claim()
    document = make_document(content)
    repository = FakeClaimRepository(claim, document)
    blob_service = FakeBlobService(content, "image/png")
    user = CurrentUser(
        user_id="customer-1",
        name="Customer",
        email="customer@example.com",
        roles=frozenset({"Customer"}),
    )

    response = await complete_upload(
        claim_id="claim-1",
        document_id="document-1",
        user=user,
        repository=repository,
        blob_service=blob_service,
    )

    assert response.status == "verified"
    assert response.document_id == "document-1"

    stored_items = await repository.list_items("claim-1", "document")
    stored_document = ClaimDocument.model_validate(
        stored_items[0].payload,
    )

    assert (
        stored_document.upload_verification_status
        == UploadVerificationStatus.VERIFIED
    )
    assert stored_document.verified_at is not None
    assert stored_document.content_sha256 is not None


@pytest.mark.asyncio
async def test_complete_upload_is_idempotent() -> None:
    content = make_png()
    claim = make_claim()
    document = make_document(content)
    document.upload_verification_status = UploadVerificationStatus.VERIFIED

    repository = FakeClaimRepository(claim, document)
    blob_service = FakeBlobService(content, "image/png")
    user = CurrentUser(
        user_id="customer-1",
        name="Customer",
        email="customer@example.com",
        roles=frozenset({"Customer"}),
    )

    first_response = await complete_upload(
        "claim-1",
        "document-1",
        user,
        repository,
        blob_service,
    )
    second_response = await complete_upload(
        "claim-1",
        "document-1",
        user,
        repository,
        blob_service,
    )

    assert first_response == second_response
    assert blob_service.download_count == 0


@pytest.mark.asyncio
async def test_complete_upload_rejects_wrong_blob_owner() -> None:
    content = b"\x89PNG\r\n\x1a\n" + b"test-content"
    claim = make_claim()
    document = make_document(content)
    document.blob_name = "another-customer/claim-1/document-1.png"

    repository = FakeClaimRepository(claim, document)
    blob_service = FakeBlobService(content, "image/png")
    user = CurrentUser(
        user_id="customer-1",
        name="Customer",
        email="customer@example.com",
        roles=frozenset({"Customer"}),
    )

    with pytest.raises(HTTPException) as error:
        await complete_upload(
            "claim-1",
            "document-1",
            user,
            repository,
            blob_service,
        )

    assert error.value.status_code == 400
    assert "does not belong" in str(error.value.detail)


@pytest.mark.asyncio
async def test_complete_upload_rejects_mismatched_size() -> None:
    content = make_png()
    claim = make_claim()
    document = make_document(content)
    document.size_bytes += 1

    repository = FakeClaimRepository(claim, document)
    blob_service = FakeBlobService(content, "image/png")
    user = CurrentUser(
        user_id="customer-1",
        name="Customer",
        email="customer@example.com",
        roles=frozenset({"Customer"}),
    )

    with pytest.raises(HTTPException) as error:
        await complete_upload(
            "claim-1",
            "document-1",
            user,
            repository,
            blob_service,
        )

    assert error.value.status_code == 400
    assert "size" in str(error.value.detail)


@pytest.mark.asyncio
async def test_complete_upload_rejects_invalid_file_content() -> None:
    content = b"not-a-real-png"
    claim = make_claim()
    document = make_document(content)
    repository = FakeClaimRepository(claim, document)
    blob_service = FakeBlobService(content, "image/png")
    user = CurrentUser(
        user_id="customer-1",
        name="Customer",
        email="customer@example.com",
        roles=frozenset({"Customer"}),
    )
