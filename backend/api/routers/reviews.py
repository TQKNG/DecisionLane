from __future__ import annotations
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.auth import CurrentUser, require_roles
from api.dependencies import get_claim_repository
from refundflow.config import get_settings
from refundflow.domain.models import AssessmentResult, ClaimStatus, RefundClaim
from refundflow.repositories.claims import ClaimRepository


router = APIRouter(prefix="/v1", tags=["reviews"])


class ReviewDetail(BaseModel):
    claim: RefundClaim
    assessment: AssessmentResult
    approvals: list[dict[str,object]]

class ApprovalRequest(BaseModel):
    decision:str
    comment: str = Field(min_length=3, max_length=2000)


@router.get("/claims", response_model=list[RefundClaim])
async def list_claims(
    user: Annotated[
        CurrentUser,
        Depends(require_roles("Customer","Reviewer","Admin"))
    ],
    requested_status:str | None = Query(default=None, alias="status"),
    repository: ClaimRepository = Depends(get_claim_repository)
)-> list[RefundClaim]:
    customer_id = None
    if "Customer" in user.roles and not user.roles.intersection({"Reviewer", "Admin"}):
        customer_id = user.user_id
    return await repository.list_claims(customer_id, requested_status)


@router.get("/reviews/{claim_id}", response_model=ReviewDetail)
async def get_review(
    claim_id:str,
    _: Annotated[CurrentUser, Depends(require_roles("Reviewer", "Admin"))],
    repository: ClaimRepository = Depends(get_claim_repository)
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
        assessment=AssessmentResult.model_validate(
            assessments[-1].payload,
            approvals = [item.payload for item in approvals]
        ),
    )


@router.post("/reviews/{claim_id}/decision",
status_code=status.HTTP_202_ACCEPTED)
async def decide_review(
    claim_id:str,
    body: ApprovalRequest,
    user: Annotated[CurrentUser, Depends(require_roles("Reviewer", "Admin"))]
)-> dict[str,str]:
    if body.decision not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="Decision must be approve or reject")
    claim = await repository.get_claim(claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status != ClaimStatus.PENDING_APPROVAL or not claim.workflow_instance_id:
        raise HTTPException(status_code=409, detail="Claim is not awaiting approval")
    existing = await repository.list_items(claim_id, "approval")
    if any(item.payload.get("reviewer_id")== user.user_id for item in existing):
        raise HTTPException(status_code=409, detail="Reviewer already decided this claim")

    settings = get_settings()
    headers = {"x-functions-key": settings.function_key} if settings.function_key else{}
    payload={
        "claim_id": claim_id,
        "reviewer_id": user.user_id,
        "reviewer_name": user.name,
        "decision": body.decision,
        "comment": body.comment
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.function_base_url}/refund-workflows/"
            f"{claim.workflow_instance_id}/approvals",
            headers=headers,
            json=payload,
        )
        if response.status_code == 409:
            raise HTTPException(status_code=409, detail="Workflow is no longer waiting")
        response.raise_for_status()
    return {"status":"accepted"}


@router.get("/admin/kpis")
async def get_admin_kpis(
    _: Annotated[CurrentUser, Depends(require_roles("Admin"))],
    repository: ClaimRepository = Depends(get_claim_repository)
)-> dict[str,object]:
    claims = await repository.list_claims()
    counts = Counter(claim.status.value for claim in claims)
    decided = counts[ClaimStatus.REFUNDED.value] + counts[ClaimStatus.REJECTED.value]
    return{
        "total_claims": len(claims),
        "pending_approval": counts[ClaimStatus.PENDING_APPROVAL.value],
        "refunded": counts[ClaimStatus.REFUNDED.value],
        "rejected": counts[ClaimStatus.REJECTED.value],
        "decision_rate": decided/len(claims) if claims else 0,
        "by_status": dict(counts)
    }