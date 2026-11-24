"""Generate the synthetic refund evaluation dataset.

Each case pairs a claim with concrete evidence text that matches policies/refund-policy.md.
`expected_eligible` is true only when the evidence satisfies every requirement for the
claim type, so the label can be checked against the policy text instead of trusted.
The five evidence states repeat in a fixed order, so any five consecutive cases cover
all of them once.
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

CLAIM_TYPES = ["damaged_item", "wrong_item", "non_delivery", "delayed_delivery"]
AMOUNTS = [Decimal("19.99"), Decimal("49.99"), Decimal("129.99"), Decimal("499.99"), Decimal("500.01")]
EVIDENCE_STATES = ["complete", "missing_receipt", "ambiguous", "late", "mismatch"]
REPETITIONS = 2
TAX_RATE = Decimal("0.13")

REASONS = {
    "damaged_item": "The item arrived with visible damage.",
    "wrong_item": "I received a different item than I ordered.",
    "non_delivery": "My order never arrived.",
    "delayed_delivery": "My order arrived much later than promised.",
}

# The supporting document the policy requires for each claim type.
REQUIRED_DOCUMENT = {
    "damaged_item": "receipt or order confirmation",
    "wrong_item": "receipt or order confirmation",
    "non_delivery": "order confirmation",
    "delayed_delivery": "shipment tracking record",
}


def money(value: Decimal) -> str:
    return f"{value:.2f}"


def split_total(total: Decimal) -> tuple[Decimal, Decimal]:
    subtotal = (total / (1 + TAX_RATE)).quantize(Decimal("0.01"))
    return subtotal, total - subtotal


def timing(claim_type: str, repetition: int) -> str:
    """Delivery timing that satisfies the policy, varied by repetition."""
    if claim_type in {"damaged_item", "wrong_item"}:
        return f"Delivered {12 + 6 * repetition} days before the claim was submitted."
    if claim_type == "non_delivery":
        return (
            f"The promised delivery date passed {6 + 2 * repetition} business days "
            "before the claim was submitted."
        )
    return f"Delivery arrived {4 + repetition} business days after the promised date."


def complete_evidence(claim_type: str, order: str, total: Decimal, repetition: int) -> str:
    when = timing(claim_type, repetition)
    if claim_type == "damaged_item":
        subtotal, tax = split_total(total)
        return (
            f"Order confirmation for {order}: item subtotal {money(subtotal)} CAD plus tax "
            f"{money(tax)} CAD, total paid {money(total)} CAD. {when} "
            "The attached photo shows the product and the damaged area clearly."
        )
    if claim_type == "wrong_item":
        return (
            f"Order confirmation for {order}: ordered item Trail backpack, total paid "
            f"{money(total)} CAD. {when} The attached photo shows the delivered item and its "
            "product label, which is a different item from the one ordered."
        )
    if claim_type == "non_delivery":
        return (
            f"Order confirmation for {order}: total paid {money(total)} CAD. Shipment tracking "
            f"shows the parcel was never delivered. {when}"
        )
    return (
        f"Shipment tracking record for {order}. {when} The requested amount is the shipping fee "
        f"of {money(total)} CAD charged on the order. No item subtotal is requested."
    )


def build_evidence(
    claim_type: str, state: str, order: str, total: Decimal, repetition: int
) -> str:
    document = REQUIRED_DOCUMENT[claim_type]
    when = timing(claim_type, repetition)
    if state == "complete":
        return complete_evidence(claim_type, order, total, repetition)
    if state == "missing_receipt":
        return f"The customer supplied supporting images but no {document}. {when}"
    if state == "ambiguous":
        return f"The order number on the supplied {document} is unreadable, so it cannot be linked to {order}."
    if state == "late":
        if claim_type == "non_delivery":
            return (
                f"The {document} for {order} is present and legible. "
                "The claim was submitted 45 days after the promised delivery date."
            )
        # These claim types were delivered, so state the delivery timing as well. Without it
        # the claim deadline and the delivery delay are easy to confuse.
        return (
            f"The {document} for {order} is present and legible. "
            f"{when if claim_type == 'delayed_delivery' else ''} "
            "The claim was submitted 45 days after delivery."
        ).replace("  ", " ")
    return f"The supplied {document} belongs to a different order, order-other-account, not {order}."


def main() -> None:
    rows = []
    sequence = 0
    for repetition in range(REPETITIONS):
        for claim_type in CLAIM_TYPES:
            for amount in AMOUNTS:
                for state in EVIDENCE_STATES:
                    sequence += 1
                    case_id = f"refund-{sequence:03d}"
                    rows.append(
                        {
                            "case_id": case_id,
                            "claim_type": claim_type,
                            "amount": str(amount),
                            "reason": REASONS[claim_type],
                            "evidence_state": state,
                            "evidence_text": build_evidence(
                                claim_type, state, f"order-{case_id}", amount, repetition
                            ),
                            "expected_eligible": state == "complete",
                        }
                    )
    path = Path("evals/datasets/refund-cases-v1.jsonl")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row) + "\n" for row in rows),
        encoding="utf-8",
    )
    print(f"Wrote {len(rows)} cases to {path}")


if __name__ == "__main__":
    main()
