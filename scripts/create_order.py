from __future__ import annotations

import asyncio
import os
from decimal import Decimal
from uuid import uuid4

from azure.identity.aio import AzureCliCredential
from refundflow.domain.models import OrderRecord
from refundflow.repositories.orders import CosmosOrderRepository


def build_order_record(
    customer_id: str,
    order_id: str | None,
    payment_intent_id: str,
    paid_amount: Decimal,
    currency: str,
) -> OrderRecord:
    return OrderRecord(
        id=order_id or f"test-order-{uuid4()}",
        customer_id=customer_id,
        currency=currency.upper(),
        paid_amount=paid_amount,
        payment_intent_id=payment_intent_id,
    )


async def main() -> None:
    customer_id = os.environ["ORDER_CUSTOMER_ID"]
    payment_intent_id = os.environ["ORDER_PAYMENT_INTENT_ID"]
    order = build_order_record(
        customer_id=customer_id,
        order_id=os.environ.get("ORDER_ID"),
        payment_intent_id=payment_intent_id,
        paid_amount=Decimal(os.environ.get("ORDER_AMOUNT", "129.99")),
        currency=os.environ.get("ORDER_CURRENCY", "CAD"),
    )

    credential = AzureCliCredential()
    repository = CosmosOrderRepository(
        os.environ["COSMOS_ENDPOINT"],
        os.environ.get("COSMOS_DATABASE", "refundflow"),
        credential,
    )
    try:
        await repository.create_order(order)
    finally:
        await repository.close()
        await credential.close()

    print(f"Created order {order.id} for customer {order.customer_id}")


if __name__ == "__main__":
    asyncio.run(main())
