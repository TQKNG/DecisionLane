import json
from decimal import Decimal

from refundflow.domain.models import (
    ClaimType,
    EvidenceBundle,
    ExtractedDocument,
    GroundedAssessmentRequest,
    PolicyCitation,
    RefundClaim,
    SafetyAnalysis,
    SafetyDecision,
)
from refundflow.workflows.assessment import POLICY_SNAPSHOT_ID, build_assessment_prompt


def make_request() -> GroundedAssessmentRequest:
    claim = RefundClaim(
        id="claim-1",
        customer_id="customer-1",
        customer_email="customer@example.com",
        order_id="order-1",
        claim_type=ClaimType.DAMAGED_ITEM,
        reason="The item arrived damaged.",
        requested_amount=Decimal("49.99"),
    )
    document = ExtractedDocument(
        document_id="document-1",
        file_name="receipt.txt",
        content_type="image/png",
        page_count=1,
        text="Order confirmation for order-1.",
        safety=SafetyAnalysis(decision=SafetyDecision.PASS, severities={}),
    )
    citation = PolicyCitation(
        policy_id="refund-policy",
        policy_version="2026-01",
        chunk_id="refund-policy-001",
        title="General eligibility",
        quote="A claim must be submitted within 30 calendar days of delivery.",
    )
    return GroundedAssessmentRequest(
        evidence=EvidenceBundle(claim=claim, documents=[document]),
        policy_citations=[citation],
        policy_snapshot_id=POLICY_SNAPSHOT_ID,
    )


def test_prompt_carries_everything_the_model_may_cite() -> None:
    request = make_request()
    payload = json.loads(build_assessment_prompt(request))

    expected = request.model_dump(mode="json")
    assert payload["evidence"]["claim"]["created_at"] == expected["evidence"]["claim"]["created_at"]
    assert payload["evidence"]["documents"][0]["text"] == "Order confirmation for order-1."
    assert payload["policy_citations"][0]["chunk_id"] == "refund-policy-001"
    assert payload["policy_snapshot_id"] == POLICY_SNAPSHOT_ID


def test_prompt_is_deterministic_for_the_same_request() -> None:
    request = make_request()
    assert build_assessment_prompt(request) == build_assessment_prompt(request)
