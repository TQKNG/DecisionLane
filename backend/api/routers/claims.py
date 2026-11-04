from decimal import Decimal
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.dependencies import get_claim_repository
from refundflow.domain.models import ClaimType, RefundClaim
from refundflow.repositories.claims import ClaimRepository

from api.auth import CurrentUser, require_roles

router = APIRouter(prefix="/v1/claims", tags=["claims"])

class CreateClaimRequest(BaseModel):
    order_id: str
    claim_type: ClaimType
    reason:str = Field(min_length=10, max_length=2000)
    requested_amount: Decimal = Field(gt=0)
    currency:str="CAD"

ClaimRepositoryDep = Annotated[
    ClaimRepository,
    Depends(get_claim_repository)
]

@router.post("",response_model=RefundClaim,status_code=status.HTTP_201_CREATED)
async def create_claim(
    body: CreateClaimRequest,
    user: Annotated[CurrentUser, Depends(require_roles("Customer"))],
    repository: ClaimRepositoryDep
)-> RefundClaim:
    customer_id = user.user_id
    claim = RefundClaim(
        id=str(uuid4()),
        customer_id=customer_id,
        customer_email=user.email,
        order_id=body.order_id,
        claim_type=body.claim_type,
        reason=body.reason,
        requested_amount = body.requested_amount,
        currency=body.currency
    )
    return await repository.create_claim(claim)

@router.get("/{claim_id}", response_model=RefundClaim)
async def get_claim(
    claim_id:str,
    user: Annotated[
        CurrentUser,
        Depends(require_roles("Customer", "Reviewer", "Admin")),
    ],
    repository: ClaimRepositoryDep
)-> RefundClaim:
    claim=await repository.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if "Customer" in user.roles and not user.roles.intersection({"Reviewer", "Admin"}):
        if claim.customer_id != user.user_id:
            raise HTTPException(status_code=404, detail="Claim not found")
    return claim