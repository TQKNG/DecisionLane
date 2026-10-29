from __future__ import annotations

from azure.core import MatchConditions
from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

from refundflow.domain.models import ClaimAggregateItem, RefundClaim


class CosmosClaimRepository:
    def __init__(
        self,
        endpoint: str,
        database_name: str,
        credential: DefaultAzureCredential,
    ) -> None:
        self._client = CosmosClient(endpoint, credential=credential)
        self._database = self._client.get_database_client(database_name)
        self._container = self._database.get_container_client("claims")

    async def close(self) -> None:
        await self._client.close()

    async def create_claim(self, claim: RefundClaim) -> RefundClaim:
        item = {
            "id": f"claim:{claim.id}",
            "claim_id": claim.id,
            "item_type": "claim",
            "payload": claim.model_dump(mode="json"),
        }
        await self._container.create_item(item)
        return claim

    async def get_claim(self, claim_id: str) -> RefundClaim | None:
        try:
            item = await self._container.read_item(
                item=f"claim:{claim_id}",
                partition_key=claim_id,
            )
        except Exception as exc:
            if getattr(exc, "status_code", None) == 404:
                return None
            raise
        return RefundClaim.model_validate(item["payload"])

    async def replace_claim(self, claim: RefundClaim) -> RefundClaim:
        item_id = f"claim:{claim.id}"
        current = await self._container.read_item(item=item_id, partition_key=claim.id)
        current["payload"] = claim.model_dump(mode="json")
        await self._container.replace_item(
            item=item_id,
            body=current,
            etag=current["_etag"],
            match_condition=MatchConditions.IfNotModified,
        )
        return claim

    async def append_item(self, item: ClaimAggregateItem) -> None:
        body = item.model_dump(mode="json", exclude_none=True)
        try:
            await self._container.create_item(body)
        except Exception as exc:
            if getattr(exc, "status_code", None) != 409:
                raise

    async def upsert_item(self, item: ClaimAggregateItem) -> None:
        await self._container.upsert_item(item.model_dump(mode="json", exclude_none=True))

    async def list_items(
        self, claim_id: str, item_type: str | None = None
    ) -> list[ClaimAggregateItem]:
        query = "SELECT * FROM c WHERE c.claim_id = @claim_id"
        parameters: list[dict[str, object]] = [{"name": "@claim_id", "value": claim_id}]
        if item_type:
            query += " AND c.item_type = @item_type"
            parameters.append({"name": "@item_type", "value": item_type})

        iterator = self._container.query_items(
            query=query,
            parameters=parameters,
            partition_key=claim_id,
        )
        return [ClaimAggregateItem.model_validate(item) async for item in iterator]

    async def list_claims(
        self,
        customer_id: str | None = None,
        status: str | None = None,
    ) -> list[RefundClaim]:
        query = "SELECT * FROM c WHERE c.item_type = 'claim'"
        parameters: list[dict[str, object]] = []
        if customer_id:
            query += " AND c.payload.customer_id = @customer_id"
            parameters.append({"name": "@customer_id", "value": customer_id})
        if status:
            query += " AND c.payload.status = @status"
            parameters.append({"name": "@status", "value": status})
        iterator = self._container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True,
        )
        return [RefundClaim.model_validate(item["payload"]) async for item in iterator]