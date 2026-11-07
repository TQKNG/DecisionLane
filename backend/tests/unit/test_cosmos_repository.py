from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest

from refundflow.repositories.cosmos import CosmosClaimRepository


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
