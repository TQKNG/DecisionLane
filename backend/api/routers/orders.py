from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.auth import CurrentUser, require_roles
from api.dependencies import get_order_repository
from api.responses import error_responses
from refundflow.domain.models import OrderRecord
from refundflow.repositories.orders import OrderRepository

router = APIRouter(prefix="/v1/admin/orders", tags=["admin"])

OrderRepositoryDep = Annotated[
    OrderRepository,
    Depends(get_order_repository),
]


class CreateOrderRequest(BaseModel):
    id: str = Field(min_length=1, max_length=100, description="Unique order identifier.")
    customer_id: str = Field(
        min_length=1,
        description="Entra object ID of the customer who owns the order.",
    )
    currency: str = Field(
        min_length=3,
        max_length=3,
        description="Three-letter order currency code.",
        examples=["CAD"],
    )
    paid_amount: Decimal = Field(gt=0, description="Amount paid for the order.")
    payment_intent_id: str = Field(
        min_length=1,
        description="Payment provider reference for the order.",
    )


@router.post(
    "",
    response_model=OrderRecord,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_admin_order",
    summary="Create a test order",
    description=(
        "For an Admin, creates an order record for local or integration testing. "
        "Production orders should normally be created by the payment integration."
    ),
    responses=error_responses(401, 403, 409),
)
async def create_admin_order(
    body: CreateOrderRequest,
    _: Annotated[CurrentUser, Depends(require_roles("Admin"))],
    repository: OrderRepositoryDep,
) -> OrderRecord:
    order = OrderRecord(**body.model_dump())
    try:
        return await repository.create_order(order)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        if getattr(exc, "status_code", None) == 409:
            raise HTTPException(
                status_code=409,
                detail=f"Order {order.id} already exists",
            ) from exc
        raise
