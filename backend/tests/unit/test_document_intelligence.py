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


def test_normalizes_explicit_currency_field_and_preserves_unknown_fields() -> None:
    fields = normalize_extracted_fields(
        {" currency ": "usd", "merchant_name": "Synthetic Store"},
        "",
    )

    assert fields == {"merchant_name": "Synthetic Store", "currency": "USD"}


def test_falls_back_to_receipt_text_when_key_value_pairs_are_empty() -> None:
    fields = normalize_extracted_fields(
        {},
        "DATE\n2026-10-06\nTOTAL PAID\n$94.92\n"
        "ORDER REFERENCE\nRF-STD-10482\nCAD",
    )

    assert fields == {
        "order_id": "RF-STD-10482",
        "purchase_date": "2026-10-06",
        "total_amount": "$94.92",
        "currency": "CAD",
    }


def test_falls_back_to_total_with_currency_code_between_label_and_amount() -> None:
    fields = normalize_extracted_fields(
        {},
        "TOTAL PAID\nCAD $94.92\nORDER REFERENCE RF-STD-10482",
    )

    assert fields["total_amount"] == "$94.92"


def test_does_not_treat_subtotal_as_total_amount() -> None:
    fields = normalize_extracted_fields(
        {},
        "SUBTOTAL\n$84.00\nTAX\n$10.92\nTOTAL PAID\n$94.92",
    )

    assert fields["total_amount"] == "$94.92"
