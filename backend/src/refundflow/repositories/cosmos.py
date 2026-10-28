from __future__ import annotations

from azure.core import MatchConditions
from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

from refundflow.domain.models import ClaimAggregateItem, RefundClaim

class CosmosClaimRepository:
    def __init__(self, endpoint:str, database_name:str, credential: DefaultAzureCredential)-> None:
        self._client = CosmosClient(endpoint, credential=credential)
        self._database = self._client.get_database_client(database_name)
        self._container = self._database.get_container_client("claims")


    async def close(self) -> None:
        await self._client.close()

    async def create_claim(self, claim: RefundClaim) -> RefundClaim:
        item = {
            "id": f"claim:{claim.id}",
            "claim_id":claim.id,
            "item_type": "claim",
            "payload": claim.model_dump(mode="json")
        }
        await self._container.create_item(item)
        return claim

    async def get_claim(self,claim_id:str) -> RefundClaim | None:
        try:
            item = await self._container.read_item(
                item=f"claim:{claim.id}",
                partition_key = claim_id
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
            match_condition= MatchConditions.IfNotModified
        )
        return claim

    async def append_item(self, item: ClaimAggregateItem)-> None:
        body = item.model_dump(mode="json", exclude_none=True)
        
