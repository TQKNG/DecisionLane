from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

import stripe


def resolve_refund_amount(
    paid_amount: Decimal,
    invoice_amount: Decimal | None,
) -> Decimal:
    if invoice_amount is None:
        raise ValueError("Invoice total amount is missing")
    normalized_paid_amount = paid_amount.quantize(Decimal("0.01"))
    normalized_invoice_amount = invoice_amount.quantize(Decimal("0.01"))
    if normalized_invoice_amount != normalized_paid_amount:
        raise ValueError("Invoice total amount does not match order paid amount")
    return normalized_paid_amount


class StripeRefundService:
    def __init__(self, secret_key: str) -> None:
        stripe.api_key = secret_key

    def create_refund(
        self,
        claim_id: str,
        payment_intent_id: str,
        amount: Decimal,
        currency: str,
    ) -> dict[str, object]:
        minor_units = int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        if minor_units < 1:
            raise ValueError("Refund amount must be at least 0.01 in the claim currency")
        refund = stripe.Refund.create(
            payment_intent=payment_intent_id,
            amount=minor_units,
            metadata={"claim_id": claim_id, "currency": currency},
            idempotency_key=f"refundflow:{claim_id}",
        )
        return {"refund_id": refund.id, "status": refund.status, "amount": minor_units}
