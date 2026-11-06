from decimal import Decimal

import pytest

from refundflow.domain.models import (
    AssessmentCriterion,
    AssessmentDraft,
    AssessmentResult,
    CriterionStatus,
    PolicyCitation,
)


def test_assessment_draft_requires_numeric_refund_amount() -> None:
    schema = AssessmentDraft.model_json_schema()
    amount_schema = schema["properties"]["proposed_refund_amount"]
    assert amount_schema["type"] == "number"

    with pytest.raises(ValueError):
        AssessmentDraft.model_validate(
            {
                "eligible": True,
                "proposed_refund_amount": "19.99 CAD",
                "confidence": 0.9,
                "requires_two_reviewers": False,
                "summary": "Evidence supports the request.",
                "criteria": [],
            }
        )


def make_assessment(amount: str) -> AssessmentResult:
    return AssessmentResult(
        claim_id="claim-1",
        eligible=True,
        proposed_refund_amount=Decimal(amount),
        confidence=0.9,
        requires_two_reviewers=False,
        summary="Evidence supports the request.",
        criteria=[
            AssessmentCriterion(
                name="policy_eligibility",
                status=CriterionStatus.PASS,
                explanation="The supplied policy supports the request.",
                citations=[
                    PolicyCitation(
                        policy_id="refund-policy",
                        policy_version="2026-01",
                        chunk_id="refund-policy-001",
                        title="Damaged item",
                        quote="A damaged-item claim requires evidence.",
                    )
                ],
            )
        ],
        model_deployment="test-model",
        prompt_version="test-prompt",
        policy_snapshot_id="refund-policy:2026-01",
    )


@pytest.mark.parametrize(
    ("amount", "requires_two_reviewers"),
    [("499.99", False), ("500.00", False), ("500.01", True)],
)
def test_two_reviewer_threshold(amount: str, requires_two_reviewers: bool) -> None:
    assessment = make_assessment(amount)
    assessment.requires_two_reviewers = assessment.proposed_refund_amount > 500
    assert assessment.requires_two_reviewers is requires_two_reviewers