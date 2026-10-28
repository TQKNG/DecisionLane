from refundflow.domain.models import SafetyDecision

REVIEW_AT_LOW_SEVERITY ={'Hate','Sexual','SelfHarm'}

def decide_image_safety(severities: dict[str,int]) -> SafetyDecision:
    if any(severity >= 6 for severity in severities.values()):
        return SafetyDecision.BLOCK

    if any(severity >=4 for severity in severities.values()):
        return SafetyDecision.REVIEW

    if any(category in REVIEW_AT_LOW_SEVERITY and severity >=2 
    for category, severity in severities.items()):
        return SafetyDecision.REVIEW

    return SafetyDecision.PASS
    