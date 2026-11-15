from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from refundflow.domain.models import ClaimAggregateItem, RefundClaim
from refundflow.repositories import cosmos
from refundflow.repositories.cosmos import CosmosClaimRepository


def make_claim() -> RefundClaim:
    return RefundClaim(
        id="claim-1",
        customer_id="customer-1",
        customer_email="customer@example.com",
        order_id="order-1",
        claim_type="damaged_item",
        reason="The item arrived damaged.",
        requested_amount="10.00",
    )


def make_item() -> ClaimAggregateItem:
    return ClaimAggregateItem(
        id="document:document-1",
        claim_id="claim-1",
        item_type="document",
        payload={"id": "document-1"},
    )


class EmptyContainer:
    def __init__(self) -> None:
        self.query_options: dict[str, Any] = {}

    def query_items(self, **kwargs: Any) -> AsyncIterator[dict[str, Any]]:
        self.query_options = kwargs
        return EmptyAsyncIterator()


class EmptyAsyncIterator:
    def __aiter__(self) -> EmptyAsyncIterator:
        return self

    async def __anext__(self) -> dict[str, Any]:
        raise StopAsyncIteration


class FakeContainer:
    def __init__(self) -> None:
        self.created_items: list[dict[str, Any]] = []
        self.read_items: list[dict[str, Any]] = []
        self.replaced_items: list[dict[str, Any]] = []
        self.upserted_items: list[dict[str, Any]] = []
        self.query_options: dict[str, Any] = {}
        self.query_results: list[dict[str, Any]] = []
        self.create_error: Exception | None = None

    async def create_item(self, item: dict[str, Any]) -> None:
        if self.create_error is not None:
            raise self.create_error
        self.created_items.append(item)

    async def read_item(self, **kwargs: Any) -> dict[str, Any]:
        self.read_items.append(kwargs)
        return {
            "id": "claim:claim-1",
            "payload": make_claim().model_dump(mode="json"),
            "_etag": "etag-1",
        }

    async def replace_item(self, **kwargs: Any) -> None:
        self.replaced_items.append(kwargs)

    async def upsert_item(self, item: dict[str, Any]) -> None:
        self.upserted_items.append(item)

    def query_items(self, **kwargs: Any) -> AsyncIterator[dict[str, Any]]:
        self.query_options = kwargs
        return ListAsyncIterator(self.query_results)


class ListAsyncIterator:
    def __init__(self, items: list[dict[str, Any]]) -> None:
        self._items = iter(items)

    def __aiter__(self) -> ListAsyncIterator:
        return self

    async def __anext__(self) -> dict[str, Any]:
        try:
            return next(self._items)
        except StopIteration:
            raise StopAsyncIteration from None


class CosmosError(RuntimeError):
    def __init__(self, message: str, status_code: int) -> None:
        super().__init__(message)
        self.status_code = status_code


@pytest.mark.asyncio
async def test_list_claims_uses_default_cross_partition_query() -> None:
    repository = CosmosClaimRepository.__new__(CosmosClaimRepository)
    container = EmptyContainer()
    repository._container = container

    claims = await repository.list_claims()

    assert claims == []
    assert container.query_options == {
        "query": "SELECT * FROM c WHERE c.item_type = 'claim'",
        "parameters": [],
    }


@pytest.mark.asyncio
async def test_list_items_without_type_filter_queries_all_claim_items() -> None:
    repository = CosmosClaimRepository.__new__(CosmosClaimRepository)
    container = FakeContainer()
    repository._container = container

    assert await repository.list_items("claim-1") == []
    assert container.query_options == {
        "query": "SELECT * FROM c WHERE c.claim_id = @claim_id",
        "parameters": [{"name": "@claim_id", "value": "claim-1"}],
        "partition_key": "claim-1",
    }


@pytest.mark.asyncio
async def test_create_and_close_use_cosmos_clients() -> None:
    container = FakeContainer()

    class FakeClient:
        def get_database_client(self, name: str) -> FakeClient:
            return self

        def get_container_client(self, name: str) -> FakeContainer:
            return container

        async def close(self) -> None:
            return None

    client = FakeClient()
    credential = AsyncMock()

    with patch.object(cosmos, "CosmosClient", return_value=client) as factory:
        repository = CosmosClaimRepository(
            "endpoint",
            "database",
            credential,
        )

    factory.assert_called_once_with("endpoint", credential=credential)
    assert repository._container is container

    claim = make_claim()
    assert await repository.create_claim(claim) == claim
    assert container.created_items[0]["id"] == "claim:claim-1"
    await repository.close()


@pytest.mark.asyncio
async def test_get_claim_returns_none_for_not_found_and_propagates_other_errors() -> None:
    repository = CosmosClaimRepository.__new__(CosmosClaimRepository)

    class MissingContainer:
        async def read_item(self, **kwargs: Any) -> None:
            raise CosmosError("not found", 404)

    repository._container = MissingContainer()
    assert await repository.get_claim("claim-1") is None

    class FailingContainer:
        async def read_item(self, **kwargs: Any) -> None:
            raise RuntimeError("unavailable")

    repository._container = FailingContainer()
    with pytest.raises(RuntimeError, match="unavailable"):
        await repository.get_claim("claim-1")


@pytest.mark.asyncio
async def test_get_claim_validates_stored_payload() -> None:
    repository = CosmosClaimRepository.__new__(CosmosClaimRepository)
    container = FakeContainer()
    repository._container = container

    claim = await repository.get_claim("claim-1")

    assert claim is not None
    assert claim.id == "claim-1"
    assert claim.customer_id == "customer-1"


@pytest.mark.asyncio
async def test_replace_claim_uses_etag_and_if_not_modified_condition() -> None:
    repository = CosmosClaimRepository.__new__(CosmosClaimRepository)
    container = FakeContainer()
    repository._container = container

    claim = make_claim()
    assert await repository.replace_claim(claim) == claim

    replaced = container.replaced_items[0]
    assert replaced["item"] == "claim:claim-1"
    assert replaced["etag"] == "etag-1"
    assert replaced["body"]["payload"]["id"] == "claim-1"


@pytest.mark.asyncio
async def test_append_item_ignores_conflicts_and_reraises_other_errors() -> None:
    repository = CosmosClaimRepository.__new__(CosmosClaimRepository)
    container = FakeContainer()
    repository._container = container
    item = make_item()

    await repository.append_item(item)
    assert container.created_items[0]["id"] == item.id

    conflict = CosmosError("already exists", 409)
    container.create_error = conflict
    await repository.append_item(item)

    container.create_error = RuntimeError("unavailable")
    with pytest.raises(RuntimeError, match="unavailable"):
        await repository.append_item(item)


@pytest.mark.asyncio
async def test_upsert_and_filtered_queries_serialize_models() -> None:
    repository = CosmosClaimRepository.__new__(CosmosClaimRepository)
    container = FakeContainer()
    repository._container = container
    item = make_item()
    claim = make_claim()
    await repository.upsert_item(item)
    assert container.upserted_items[0]["id"] == item.id

    container.query_results = [item.model_dump(mode="json")]
    items = await repository.list_items("claim-1", "document")
    assert items == [item]
    assert container.query_options["parameters"] == [
        {"name": "@claim_id", "value": "claim-1"},
        {"name": "@item_type", "value": "document"},
    ]

    container.query_results = [
        {
            "id": "claim:claim-1",
            "payload": claim.model_dump(mode="json"),
        },
    ]
    claims = await repository.list_claims(customer_id="customer-1", status="draft")
    assert claims == [claim]
    assert container.query_options["parameters"] == [
        {"name": "@customer_id", "value": "customer-1"},
        {"name": "@status", "value": "draft"},
    ]
