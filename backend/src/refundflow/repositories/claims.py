from __future__ import annotations

from collections import defaultdict
from typing import Protocol

from refundflow.domain.models import ClaimAggregateItem, RefundClaim


class ClaimRepository(Protocol):
    async def create_claim(self, claim:RefundClaim)->RefundClaim:
        ...

    async def get_claim(self, claim_id:str) -> RefundClaim | None:
        ...

    async def replace_claim(self, claim: RefundClaim) -> RefundClaim:
        ...

    async def append_item(self, item:ClaimAggregateItem) -> None:
        ...

    async def upsert_item(self, item: ClaimAggregateItem) -> None:
        ...

    async def list_items(
        self,
        claim_id:str,
        item_type:str| None = None) -> list[ClaimAggregateItem]:
        ...
    
    async def list_claims(
        self, 
        customer_id:str | None = None, 
        status:str | None = None) -> list[RefundClaim]:
        ...
    
class InMemoryClaimRepository:
    def __init__(self) -> None:
        self._claims: dict[str, RefundClaim] = {}
        self._items: dict[str, list[ClaimAggregateItem]] = defaultdict(list)

    async def create_claim(self, claim: RefundClaim) -> RefundClaim:
        if claim.id in self._claims:
            raise ValueError(f"Claim {claim.id} already exists")
        self._claims[claim.id] = claim.model_copy(deep=True)
        return claim

    async def get_claim(self, claim_id: str) -> RefundClaim | None:
        claim = self._claims.get(claim_id)
        return claim.model_copy(deep=True) if claim else None

    async def replace_claim(self, claim: RefundClaim) -> RefundClaim:
        if claim.id not in self._claims:
            raise KeyError(claim.id)
        self._claims[claim.id] = claim.model_copy(deep=True)
        return claim

    async def append_item(self, item: ClaimAggregateItem) -> None:
        if any(existing.id == item.id for existing in self._items[item.claim_id]):
            return
        self._items[item.claim_id].append(item.model_copy(deep=True))

    async def upsert_item(self, item: ClaimAggregateItem) -> None:
        items = self._items[item.claim_id]
        self._items[item.claim_id] = [value for value in items if value.id != item.id]
        self._items[item.claim_id].append(item.model_copy(deep=True))

    async def list_items(
        self, claim_id: str, item_type: str | None = None
    ) -> list[ClaimAggregateItem]:
        items = self._items.get(claim_id, [])
        if item_type:
            items = [item for item in items if item.item_type == item_type]
        return [item.model_copy(deep=True) for item in items]

    async def list_claims(
        self,
        customer_id: str | None = None,
        status: str | None = None,
    ) -> list[RefundClaim]:
        claims = list(self._claims.values())
        if customer_id:
            claims = [value for value in claims if value.customer_id == customer_id]
        if status:
            claims = [value for value in claims if value.status.value == status]
        return [value.model_copy(deep=True) for value in claims]