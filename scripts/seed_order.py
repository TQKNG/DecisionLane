from __future__ import annotations

import asyncio
import os
from decimal import Decimal

from azure.identity.aio import AzureCliCredential
from refundflow.domain.models import OrderRecord
from refundflow.repositories.orders import CosmosOrderRepository


async def main() -> None:
    credential = AzureCliCredential()
    repository = CosmosOrderRepository(
        os.environ["COSMOS_ENDPOINT"],
        os.environ.get("COSMOS_DATABASE", "refundflow"),
        credential,
    )
    try:
        await repository.upsert_order(
            OrderRecord(
                id=os.environ["DEMO_ORDER_ID"],
                customer_id=os.environ["DEMO_CUSTOMER_OBJECT_ID"],
                currency="CAD",
                paid_amount=Decimal("129.99"),
                payment_intent_id=os.environ["DEMO_PAYMENT_INTENT_ID"],
            )
        )
    finally:
        await repository.close()
        await credential.close()


if __name__ == "__main__":
    asyncio.run(main())