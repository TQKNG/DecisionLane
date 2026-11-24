from __future__ import annotations

from azure.core.credentials import AzureKeyCredential
from azure.search.documents.aio import SearchClient
from azure.search.documents.models import VectorizedQuery

from refundflow.domain.models import PolicyCitation, RefundClaim
from refundflow.services.embeddings import EmbeddingService


class PolicySearchService:
    def __init__(
        self,
        endpoint: str,
        index_name:str,
        query_key:str,
        embedding_service: EmbeddingService
    ) -> None:
        self._client = SearchClient(
            endpoint = endpoint,
            index_name = index_name,
            credential= AzureKeyCredential(query_key)
        )
        self._embedding_service = embedding_service

    async def search(self, query:str, top:int = 5)-> list[PolicyCitation]:
        vector = (await self._embedding_service.embed([query]))[0]
        vector_query = VectorizedQuery(
            vector=vector,
            k=top,
            fields="content_vector"
        )
        results = await self._client.search(
            search_text=query,
            vector_queries=[vector_query],
            select=[
                "policy_id",
                "policy_version",
                "chunk_id",
                "title",
                "content"
            ],
            top=top
        )
        citations: list[PolicyCitation]=[]
        async for result in results:
            citations.append(
                PolicyCitation(
                    policy_id=result["policy_id"],
                    policy_version=result["policy_version"],
                    chunk_id=result["chunk_id"],
                    title=result["title"],
                    quote=result["content"][:800]   
                )
            )
        return citations

    async def close(self) -> None:
        await self._client.close()


# Rules that apply to every claim type (submission window, order identification).
# The claim-specific query rarely ranks them, so they are retrieved separately.
GENERAL_POLICY_QUERY = (
    "General eligibility: claim submission deadline and order identifier requirements"
)


def build_claim_policy_query(claim: RefundClaim) -> str:
    return (
        f"Refund requirements for {claim.claim_type.value}. "
        f"Requested amount {claim.requested_amount} {claim.currency}. "
        f"Reason: {claim.reason}"
    )


async def retrieve_policy_passages(
    policy_search: PolicySearchService,
    claim: RefundClaim,
    top: int = 5,
) -> list[PolicyCitation]:
    """Return claim-specific passages plus the general eligibility rules, without duplicates."""
    passages = await policy_search.search(build_claim_policy_query(claim), top=top)
    if not passages:
        # Keep the original failure condition: the general rules alone are not a usable result.
        return []
    general = await policy_search.search(GENERAL_POLICY_QUERY, top=1)
    seen = {citation.chunk_id for citation in passages}
    return [*passages, *(citation for citation in general if citation.chunk_id not in seen)]
