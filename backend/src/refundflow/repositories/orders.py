from __future__ import annotations

from decimal import Decimal
from typing import Protocol

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

from refundflow.domain.models import OrderRecord


class OrderRepository(Protocol):
    async def get_order(self, customer_id: str, order_id: str) -> OrderRecord | None: ...

    async def create_order(self, order: OrderRecord) -> OrderRecord: ...


class InMemoryOrderRepository:
    def __init__(self) -> None:
        self._orders: dict[str, OrderRecord] = {
            "order-1001": OrderRecord(
                id="order-1001",
                customer_id="local-customer",
                currency="CAD",
                paid_amount=Decimal("129.99"),
                payment_intent_id="pi_local_test",
            )
        }

    async def get_order(self, customer_id: str, order_id: str) -> OrderRecord | None:
        order = self._orders.get(order_id)
        if order is None or order.customer_id != customer_id:
            return None
        return order.model_copy(deep=True)

    async def create_order(self, order: OrderRecord) -> OrderRecord:
        if order.id in self._orders:
            raise ValueError(f"Order {order.id} already exists")
        self._orders[order.id] = order.model_copy(deep=True)
        return order


class CosmosOrderRepository:
    def __init__(
        self,
        endpoint: str,
        database_name: str,
        credential: DefaultAzureCredential,
    ) -> None:
        self._client = CosmosClient(endpoint, credential=credential)
        database = self._client.get_database_client(database_name)
        self._container = database.get_container_client("orders")

    async def get_order(self, customer_id: str, order_id: str) -> OrderRecord | None:
        try:
            item = await self._container.read_item(order_id, partition_key=customer_id)
        except Exception as exc:
            if getattr(exc, "status_code", None) == 404:
                return None
            raise
        return OrderRecord.model_validate(item)

    async def upsert_order(self, order: OrderRecord) -> None:
        await self._container.upsert_item(order.model_dump(mode="json"))

    async def create_order(self, order: OrderRecord) -> OrderRecord:
        await self._container.create_item(order.model_dump(mode="json"))
        return order

    async def close(self) -> None:
        await self._client.close()
