from decimal import Decimal
from typing import Any, cast

from refundflow.domain.models import ClaimType, PolicyCitation, RefundClaim
from refundflow.services.policy_search import (
    GENERAL_POLICY_QUERY,
    PolicySearchService,
    build_claim_policy_query,
    retrieve_policy_passages,
)


def make_citation(chunk_id: str, title: str) -> PolicyCitation:
    return PolicyCitation(
        policy_id="refund-policy",
        policy_version="2026-01",
        chunk_id=chunk_id,
        title=title,
        quote=f"{title} text",
    )


def make_claim() -> RefundClaim:
    return RefundClaim(
        id="claim-1",
        customer_id="customer-1",
        customer_email="customer@example.com",
        order_id="order-1",
        claim_type=ClaimType.DAMAGED_ITEM,
        reason="The item arrived damaged.",
        requested_amount=Decimal("49.99"),
    )


class FakePolicySearch:
    def __init__(self, results: dict[str, list[PolicyCitation]]) -> None:
        self._results = results
        self.calls: list[tuple[str, int]] = []

    async def search(self, query: str, top: int = 5) -> list[PolicyCitation]:
        self.calls.append((query, top))
        return self._results[query][:top]


def as_service(fake: FakePolicySearch) -> PolicySearchService:
    return cast(Any, fake)


async def test_adds_general_eligibility_when_claim_query_misses_it() -> None:
    claim = make_claim()
    general = make_citation("refund-policy-001", "General eligibility")
    damaged = make_citation("refund-policy-002", "Damaged item")
    fake = FakePolicySearch(
        {build_claim_policy_query(claim): [damaged], GENERAL_POLICY_QUERY: [general]}
    )

    passages = await retrieve_policy_passages(as_service(fake), claim)

    assert [item.chunk_id for item in passages] == ["refund-policy-002", "refund-policy-001"]


async def test_does_not_duplicate_general_eligibility_already_retrieved() -> None:
    claim = make_claim()
    general = make_citation("refund-policy-001", "General eligibility")
    damaged = make_citation("refund-policy-002", "Damaged item")
    fake = FakePolicySearch(
        {build_claim_policy_query(claim): [general, damaged], GENERAL_POLICY_QUERY: [general]}
    )

    passages = await retrieve_policy_passages(as_service(fake), claim)

    assert [item.chunk_id for item in passages] == ["refund-policy-001", "refund-policy-002"]


async def test_requests_one_general_passage_and_keeps_the_claim_query_limit() -> None:
    claim = make_claim()
    fake = FakePolicySearch(
        {
            build_claim_policy_query(claim): [make_citation("refund-policy-002", "Damaged item")],
            GENERAL_POLICY_QUERY: [make_citation("refund-policy-001", "General eligibility")],
        }
    )

    await retrieve_policy_passages(as_service(fake), claim, top=3)

    assert fake.calls == [(build_claim_policy_query(claim), 3), (GENERAL_POLICY_QUERY, 1)]


async def test_returns_empty_when_nothing_is_retrieved() -> None:
    claim = make_claim()
    fake = FakePolicySearch({build_claim_policy_query(claim): [], GENERAL_POLICY_QUERY: []})

    assert await retrieve_policy_passages(as_service(fake), claim) == []
