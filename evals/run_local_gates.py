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
    print("Local evaluation gates passed")


if __name__ == "__main__":
    main()