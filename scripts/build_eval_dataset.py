from __future__ import annotations

import json
from pathlib import Path

CLAIM_TYPES = ["damaged_item", "wrong_item", "non_delivery", "delayed_delivery"]
AMOUNTS = [19.99, 49.99, 129.99, 499.99, 500.01]
EVIDENCE_STATES = [
    ("complete", True, "Receipt and required evidence are present."),
    ("missing_receipt", False, "The customer supplied an image but no receipt."),
    ("ambiguous", False, "The order number is unreadable and requires review."),
    ("late", False, "The claim was submitted 45 days after delivery."),
    ("mismatch", False, "The receipt belongs to a different order."),
]

def main() -> None:
    rows = []
    sequence = 0
    for repetition in range(2):
        for claim_type in CLAIM_TYPES:
            for amount in AMOUNTS:
                for evidence_state, expected_eligible, evidence_text in EVIDENCE_STATES:
                    sequence += 1
                    rows.append(
                        {
                            "case_id": f"refund-{sequence:03d}",
                            "claim_type": claim_type,
                            "amount": str(amount),
                            "reason": f"Evaluation case for {claim_type}, variant {repetition}.",
                            "evidence_state": evidence_state,
                            "evidence_text": evidence_text,
                            "expected_eligible": expected_eligible,
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