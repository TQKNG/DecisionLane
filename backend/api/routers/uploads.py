from __future__ import annotations

from typing import Annotated, Literal

import httpx
from azure.identity.aio import DefaultAzureCredential
from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field

from api.auth import CurrentUser, require_roles
from api.dependencies import get_claim_repository
from api.responses import error_responses
from refundflow.config import get_settings
from refundflow.domain.models import (
    ClaimAggregateItem,
    ClaimDocument,
    ClaimStatus,
    RefundClaim,
)
from refundflow.repositories.claims import ClaimRepository
from refundflow.services.blob_storage import (
    MAX_FILE_BYTES,
    MAX_FILES_PER_CLAIM,
    BlobStorageService,
)

router = APIRouter(prefix="/v1/claims", tags=["uploads"])

ClaimRepositoryDep = Annotated[
    ClaimRepository,
    Depends(get_claim_repository),
]


class UploadRequest(BaseModel):
    file_name: str = Field(
        min_length=1,
        max_length=255,
        description="Original file name for display.",
    )
    content_type: str = Field(
        description="MIME content type of the evidence file.",
        examples=["image/jpeg"],
    )
    size_bytes: int = Field(
        gt=0,
        le=MAX_FILE_BYTES,
        description=f"File size in bytes; maximum is {MAX_FILE_BYTES}.",
    )


class UploadGrant(BaseModel):
    """Grant for uploading one file directly to quarantine Blob Storage."""

    document_id: str
    blob_name: str
    upload_url: str
    required_headers: dict[str, str]


class UploadCompleteResponse(BaseModel):
    status: Literal["uploaded"]
    document_id: str


class ClaimSubmissionResponse(BaseModel):
    status: Literal["scanning"]
    workflow_instance_id: str


def get_blob_service() -> BlobStorageService:
    settings = get_settings()
    return BlobStorageService(
        settings.storage_account_name,
        settings.storage_account_url,
        DefaultAzureCredential(),
        settings.quarantine_container,
    )


BlobStorageServiceDep = Annotated[
    BlobStorageService,
    Depends(get_blob_service),
]


async def get_owned_claim(
    claim_id: str,
    user: CurrentUser,
    repository: ClaimRepository,
) -> RefundClaim:
    claim = await repository.get_claim(claim_id)
    if not claim or claim.customer_id != user.user_id:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@router.post(
    "/{claim_id}/uploads",
    response_model=UploadGrant,
    operation_id="request_claim_upload",
    summary="Request an evidence upload",
    description=(
        "For the owning Customer, creates a short-lived direct-to-Blob upload grant "
        "for evidence belonging to the claim. Upload the file to `upload_url` using "
        "the returned `required_headers`; the Blob request is not an API operation."
    ),
    responses=error_responses(400, 401, 403, 404, 409),
)
async def request_upload(
    claim_id: Annotated[str, Path(description="Unique identifier of the claim.")],
    body: UploadRequest,
    user: Annotated[CurrentUser, Depends(require_roles("Customer"))],
    repository: ClaimRepositoryDep,
    blob_service: BlobStorageServiceDep,
) -> UploadGrant:
    claim = await get_owned_claim(claim_id, user, repository)
    documents = await repository.list_items(claim_id, "document")
    if len(documents) >= MAX_FILES_PER_CLAIM:
        raise HTTPException(status_code=409, detail="A claim can contain at most five files")
    try:
        document_id, blob_name, upload_url = await blob_service.create_upload_url(
            user.user_id,
            claim_id,
            body.content_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    document = ClaimDocument(
        id=document_id,
        claim_id=claim_id,
        file_name=body.file_name,
        content_type=body.content_type,
        size_bytes=body.size_bytes,
        blob_name=blob_name,
    )
    await repository.append_item(
        ClaimAggregateItem(
            id=f"document:{document_id}",
            claim_id=claim_id,
            item_type="document",
            payload=document.model_dump(mode="json"),
        )
    )
    claim.status = ClaimStatus.UPLOADING
    await repository.replace_claim(claim)
    return UploadGrant(
        document_id=document_id,
        blob_name=blob_name,
        upload_url=upload_url,
        required_headers={"x-ms-blob-type": "BlockBlob", "Content-Type": body.content_type},
    )


@router.post(
    "/{claim_id}/uploads/{document_id}/complete",
    response_model=UploadCompleteResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="complete_claim_upload",
    summary="Confirm an evidence upload",
    description=(
        "For the owning Customer, verifies the uploaded Blob size and content type "
        "against the original upload request."
    ),
    responses=error_responses(400, 401, 403, 404),
)
async def complete_upload(
    claim_id: Annotated[str, Path(description="Unique identifier of the claim.")],
    document_id: Annotated[str, Path(description="Unique identifier of the uploaded document.")],
    user: Annotated[CurrentUser, Depends(require_roles("Customer"))],
    repository: ClaimRepositoryDep,
    blob_service: BlobStorageServiceDep,
) -> UploadCompleteResponse:
    await get_owned_claim(claim_id, user, repository)
    documents = await repository.list_items(claim_id, "document")
    item = next(
        (value for value in documents if value.payload.get("id") == document_id),
        None,
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Document not found")
    document = ClaimDocument.model_validate(item.payload)
    properties = await blob_service.get_blob_properties(document.blob_name)
    if properties.size != document.size_bytes:
        raise HTTPException(status_code=400, detail="Uploaded size does not match request")
    if properties.content_settings.content_type != document.content_type:
        raise HTTPException(status_code=400, detail="Uploaded content type does not match request")
    return UploadCompleteResponse(status="uploaded", document_id=document_id)


@router.post(
    "/{claim_id}/submit",
    response_model=ClaimSubmissionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="submit_claim",
    summary="Submit a claim for processing",
    description=(
        "For the owning Customer, starts the refund assessment workflow after at "
        "least one evidence file has been added to the claim."
    ),
    responses=error_responses(400, 401, 403, 404, 409),
)
async def submit_claim(
    claim_id: Annotated[str, Path(description="Unique identifier of the claim.")],
    user: Annotated[CurrentUser, Depends(require_roles("Customer"))],
    repository: ClaimRepositoryDep,
) -> ClaimSubmissionResponse:
    claim = await get_owned_claim(claim_id, user, repository)
    if claim.status not in {ClaimStatus.DRAFT, ClaimStatus.UPLOADING}:
        raise HTTPException(status_code=409, detail="Claim is already submitted")
    documents = await repository.list_items(claim_id, "document")
    if not documents:
        raise HTTPException(status_code=400, detail="At least one document is required")

    settings = get_settings()
    headers = {"x-functions-key": settings.function_key} if settings.function_key else {}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.function_base_url}/refund-workflows",
            headers=headers,
            json={
                "claim_id": claim_id,
                "document_ids": [item.payload["id"] for item in documents],
            },
        )
        response.raise_for_status()
    workflow_instance_id = response.json()["id"]
    claim.status = ClaimStatus.SCANNING
    claim.workflow_instance_id = workflow_instance_id
    await repository.replace_claim(claim)
    return ClaimSubmissionResponse(
        status="scanning",
        workflow_instance_id=workflow_instance_id,
    )
