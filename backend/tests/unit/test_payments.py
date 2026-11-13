from decimal import Decimal

import pytest

from refundflow.services import payments
from refundflow.services.payments import StripeRefundService, resolve_refund_amount


@pytest.mark.parametrize(
    ("paid_amount", "invoice_amount", "expected_amount"),
    [("94.92", "94.92", "94.92"), ("100.00", "100.00", "100.00")],
)
def test_refund_amount_uses_full_paid_amount_when_invoice_matches(
    paid_amount: str,
    invoice_amount: str,
    expected_amount: str,
) -> None:
    assert resolve_refund_amount(
        Decimal(paid_amount),
        Decimal(invoice_amount),
    ) == Decimal(expected_amount)


def test_refund_amount_rejects_invoice_mismatch() -> None:
    with pytest.raises(ValueError, match="does not match"):
        resolve_refund_amount(Decimal("94.92"), Decimal("84.00"))


def test_refund_amount_rejects_missing_invoice_amount() -> None:
    with pytest.raises(ValueError, match="is missing"):
        resolve_refund_amount(Decimal("94.92"), None)


def test_create_refund_rejects_amount_that_rounds_to_zero(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_if_called(**_: object) -> None:
        raise AssertionError("Stripe must not be called for a zero-cent refund")

    monkeypatch.setattr(payments.stripe.Refund, "create", fail_if_called)

    service = StripeRefundService("sk_test_example")

    with pytest.raises(
        ValueError,
        match="Refund amount must be at least 0.01",
    ):
        service.create_refund(
            claim_id="claim-1",
            payment_intent_id="pi_test",
            amount=Decimal("0.004"),
            currency="CAD",
        )
