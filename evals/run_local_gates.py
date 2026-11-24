from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    rows = [json.loads(line) for line in Path("evals/datasets/refund-cases-v1.jsonl").read_text().splitlines()]
    assert len(rows) == 200
    assert {row["claim_type"] for row in rows} == {
        "damaged_item", "wrong_item", "non_delivery", "delayed_delivery"
    }
    assert any(float(row["amount"]) > 500 for row in rows)
    assert any(row["evidence_state"] == "missing_receipt" for row in rows)
    assert all(len(row["reason"]) <= 2000 for row in rows)
    assert all(row["evidence_text"].strip() for row in rows)
    assert all(row["expected_eligible"] == (row["evidence_state"] == "complete") for row in rows)
    # An eligible label is only credible when the evidence names the order and the amount.
    for row in rows:
        if row["evidence_state"] == "complete":
            assert f"order-{row['case_id']}" in row["evidence_text"], row["case_id"]
            assert row["amount"] in row["evidence_text"], row["case_id"]
    # Five consecutive cases from any multiple of five hold every evidence state once,
    # which keeps each weekly window balanced.
    states = ["complete", "missing_receipt", "ambiguous", "late", "mismatch"]
    for start in range(0, len(rows), 5):
        assert [row["evidence_state"] for row in rows[start : start + 5]] == states, start
    print("Local evaluation gates passed")


if __name__ == "__main__":
    main()