import pytest

from refundflow.domain.models import SafetyDecision
from refundflow.domain.safety_policy import decide_image_safety

@pytest.mark.parametrize(
    ("scores","expected"),
    [
        ({"Hate":0, "Sexual":0, "SelfHarm":0, "Violence":0},SafetyDecision.PASS),
         ({"Hate": 0, "Sexual": 0, "SelfHarm": 0, "Violence": 2}, SafetyDecision.PASS),
        ({"Hate": 2, "Sexual": 0, "SelfHarm": 0, "Violence": 0}, SafetyDecision.REVIEW),
        ({"Hate": 0, "Sexual": 0, "SelfHarm": 0, "Violence": 4}, SafetyDecision.REVIEW),
        ({"Hate": 0, "Sexual": 6, "SelfHarm": 0, "Violence": 0}, SafetyDecision.BLOCK)
    ]
)
def test_decide_image_safety(scores: dict[str,int], expected: SafetyDecision)-> None:
    assert decide_image_safety(scores) == expected