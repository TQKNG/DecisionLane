from __future__ import annotations

from collections import Counter
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, Field

from api.auth import CurrentUser, require_roles
from api.dependencies import get_claim_repository
from api.responses import error_responses
from refundflow.config import get_settings
from refundflow.domain.models import AssessmentResult, ClaimStatus, RefundClaim
from refundflow.repositories.claims import ClaimRepository

router = APIRouter(prefix="/v1")

ClaimRepositoryDep = Annotated[
    ClaimRepository,
    Depends(get_claim_repository),
]


class ApprovalRecord(BaseModel):
    claim_id: str
    reviewer_id: str
    reviewer_name: str
    decision: str
    comment: str


class ReviewDetail(BaseModel):
    claim: RefundClaim
    assessment: AssessmentResult
    approvals: list[ApprovalRecord]


class ApprovalRequest(BaseModel):
    decision: str = Field(
        description="Reviewer decision; must be either `approve` or `reject`.",
        examples=["approve"],
        json_schema_extra={"enum": ["approve", "reject"]},
    )
    comment: str = Field(
        min_length=3,
        max_length=2000,
        description="Reviewer rationale for the decision.",
    )


class ReviewDecisionResponse(BaseModel):
    status: Literal["accepted"]


@router.get(
    "/claims",
    response_model=list[RefundClaim],
    tags=["claims"],
    operation_id="list_claims",
    summary="List refund claims",
    description=(
        "Customers receive only their own claims. Reviewers and Admins can list "
        "claims across customers. Optionally filter by the claim status string."
    ),
    responses=error_responses(401, 403),
)
async def list_claims(
    user: Annotated[CurrentUser, Depends(require_roles("Customer", "Reviewer", "Admin"))],
    repository: ClaimRepositoryDep,
    requested_status: str | None = Query(
        default=None,
        alias="status",
        description="Optional claim status filter.",
    ),
) -> list[RefundClaim]:
    print(user, repository, requested_status)
    customer_id = None
    if "Customer" in user.roles and not user.roles.intersection({"Reviewer", "Admin"}):
        customer_id = user.user_id
    return await repository.list_claims(customer_id, requested_status)


@router.get(
    "/reviews/{claim_id}",
    response_model=ReviewDetail,
    tags=["reviews"],
    operation_id="get_review",
    summary="Get a claim assessment for review",
    description=(
        "For a Reviewer or Admin, returns a claim, its latest assessment, and "
        "recorded reviewer decisions."
    ),
    responses=error_responses(401, 403, 404, 409),
)
async def get_review(
    claim_id: Annotated[str, Path(description="Unique identifier of the claim.")],
    _: Annotated[CurrentUser, Depends(require_roles("Reviewer", "Admin"))],
    repository: ClaimRepositoryDep,
) -> ReviewDetail:
    claim = await repository.get_claim(claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    assessments = await repository.list_items(claim_id, "assessment")
    if not assessments:
        raise HTTPException(status_code=409, detail="Assessment is not ready")
    approvals = await repository.list_items(claim_id, "approval")
    return ReviewDetail(
        claim=claim,
        assessment=AssessmentResult.model_validate(assessments[-1].payload),
        approvals=[ApprovalRecord.model_validate(item.payload) for item in approvals],
    )


@router.post(
    "/reviews/{claim_id}/decision",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ReviewDecisionResponse,
    tags=["reviews"],
    operation_id="decide_review",
    summary="Submit a reviewer decision",
    description=(
        "For a Reviewer or Admin, submits an approval or rejection for a claim awaiting review. "
        "The workflow may require decisions from two distinct reviewers."
    ),
    responses=error_responses(400, 401, 403, 404, 409),
)
async def decide_review(
    claim_id: Annotated[str, Path(description="Unique identifier of the claim.")],
    body: ApprovalRequest,
    user: Annotated[CurrentUser, Depends(require_roles("Reviewer", "Admin"))],
    repository: ClaimRepositoryDep,
) -> ReviewDecisionResponse:
    if body.decision not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="Decision must be approve or reject")
    claim = await repository.get_claim(claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status != ClaimStatus.PENDING_APPROVAL or not claim.workflow_instance_id:
        raise HTTPException(status_code=409, detail="Claim is not awaiting approval")
    existing = await repository.list_items(claim_id, "approval")
    if any(item.payload.get("reviewer_id") == user.user_id for item in existing):
        raise HTTPException(status_code=409, detail="Reviewer already decided this claim")

    settings = get_settings()
    headers = {"x-functions-key": settings.function_key} if settings.function_key else {}
    payload = {
        "claim_id": claim_id,
        "reviewer_id": user.user_id,
        "reviewer_name": user.name,
        "decision": body.decision,
        "comment": body.comment,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.function_base_url}/refund-workflows/{claim.workflow_instance_id}/approvals",
            headers=headers,
            json=payload,
        )
        if response.status_code == 409:
            raise HTTPException(status_code=409, detail="Workflow is no longer waiting")
        response.raise_for_status()
    return ReviewDecisionResponse(status="accepted")


class AdminKpis(BaseModel):
    total_claims: int
    pending_approval: int
    refunded: int
    rejected: int
    decision_rate: float = Field(ge=0, le=1)
    by_status: dict[str, int]


@router.get(
    "/admin/kpis",
    response_model=AdminKpis,
    tags=["admin"],
    operation_id="get_admin_kpis",
    summary="Get administrative claim metrics",
    description="Returns claim totals and counts grouped by status for an Admin.",
    responses=error_responses(401, 403),
)
async def get_admin_kpis(
    _: Annotated[CurrentUser, Depends(require_roles("Admin"))],
    repository: ClaimRepositoryDep,
) -> AdminKpis:
    claims = await repository.list_claims()
    counts = Counter(claim.status.value for claim in claims)
    decided = counts[ClaimStatus.REFUNDED.value] + counts[ClaimStatus.REJECTED.value]
    return AdminKpis(
        total_claims=len(claims),
        pending_approval=counts[ClaimStatus.PENDING_APPROVAL.value],
        refunded=counts[ClaimStatus.REFUNDED.value],
        rejected=counts[ClaimStatus.REJECTED.value],
        decision_rate=decided / len(claims) if claims else 0,
        by_status=dict(counts),
    )

