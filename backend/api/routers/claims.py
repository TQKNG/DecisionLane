from decimal import Decimal
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field

from api.auth import CurrentUser, require_roles
from api.dependencies import get_claim_repository, get_order_repository
from api.responses import error_responses
from refundflow.domain.models import ClaimType, RefundClaim
from refundflow.repositories.claims import ClaimRepository
from refundflow.repositories.orders import OrderRepository

router = APIRouter(prefix="/v1/claims", tags=["claims"])


class CreateClaimRequest(BaseModel):
    order_id: str = Field(description="Identifier of an order owned by the signed-in customer.")
    claim_type: ClaimType = Field(description="Reason category for the refund claim.")
    reason: str = Field(
        min_length=10,
        max_length=2000,
        description="Explanation of the refund request.",
    )
    requested_amount: Decimal = Field(
        gt=0,
        description="Requested refund amount; must not exceed the amount paid for the order.",
    )
    currency: str = Field(
        default="CAD",
        description="Currency code, which must match the order.",
        examples=["CAD"],
    )


ClaimRepositoryDep = Annotated[ClaimRepository, Depends(get_claim_repository)]

OrderRepositoryDep = Annotated[OrderRepository, Depends(get_order_repository)]


@router.post(
    "",
    response_model=RefundClaim,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_claim",
    summary="Create a refund claim",
    description=(
        "Creates a claim for an order owned by the signed-in customer. "
        "The requested amount and currency must be compatible with the paid order."
    ),
    responses=error_responses(400, 401, 403, 404),
)
async def create_claim(
    body: CreateClaimRequest,
    user: Annotated[CurrentUser, Depends(require_roles("Customer"))],
    repository: ClaimRepositoryDep,
    order_repository: OrderRepositoryDep,
) -> RefundClaim:
    customer_id = user.user_id

    order = await order_repository.get_order(customer_id, body.order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.currency != body.currency or body.requested_amount > order.paid_amount:
        raise HTTPException(
            status_code=400,
            detail="Requested refund exceeds the paid order amount",
        )

    claim = RefundClaim(
        id=str(uuid4()),
        customer_id=customer_id,
        customer_email=user.email,
        order_id=body.order_id,
        claim_type=body.claim_type,
        reason=body.reason,
        requested_amount=body.requested_amount,
        currency=body.currency,
    )
    return await repository.create_claim(claim)


@router.get(
    "/{claim_id}",
    response_model=RefundClaim,
    operation_id="get_claim",
    summary="Get a refund claim",
    description=(
        "Returns a claim to its owning Customer or to an authenticated Reviewer or Admin. "
        "A customer who does not own the claim receives a not-found response."
    ),
    responses=error_responses(401, 403, 404),
)
async def get_claim(
    claim_id: Annotated[str, Path(description="Unique identifier of the claim.")],
    user: Annotated[
        CurrentUser,
        Depends(require_roles("Customer", "Reviewer", "Admin")),
    ],
    repository: ClaimRepositoryDep,
) -> RefundClaim:
    claim = await repository.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if "Customer" in user.roles and not user.roles.intersection({"Reviewer", "Admin"}):
        if claim.customer_id != user.user_id:
            raise HTTPException(status_code=404, detail="Claim not found")
    return claim
