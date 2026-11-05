from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

import stripe


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
        refund = stripe.Refund.create(
            payment_intent=payment_intent_id,
            amount=minor_units,
            metadata={"claim_id": claim_id, "currency": currency},
            idempotency_key=f"refundflow:{claim_id}",
        )
        return {"refund_id": refund.id, "status": refund.status, "amount": minor_units}