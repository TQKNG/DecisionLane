from refundflow.services.document_intelligence import normalize_extracted_fields


def test_normalizes_receipt_field_labels_and_explicit_currency() -> None:
    fields = normalize_extracted_fields(
        {
            "ORDER REFERENCE": "RF-STD-10482",
            "DATE": "2026-10-06",
            "TOTAL PAID": "$94.92",
        },
        "Order reference RF-STD-10482\nTotal paid $94.92 CAD",
    )

    assert fields == {
        "order_id": "RF-STD-10482",
        "purchase_date": "2026-10-06",
        "total_amount": "$94.92",
        "currency": "CAD",
    }


def test_dollar_symbol_does_not_infer_currency() -> None:
    fields = normalize_extracted_fields(
        {"TOTAL PAID": "$94.92"},
        "TOTAL PAID $94.92",
    )

    assert "currency" not in fields
