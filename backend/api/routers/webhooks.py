from __future__ import annotations

import stripe
from azure.identity import DefaultAzureCredential
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from api.dependencies import get_claim_repository
from refundflow.config import get_settings
from refundflow.domain.models import ClaimStatus
from refundflow.repositories.claims import ClaimRepository
from refundflow.services.email import StatusEmailService


router = APIRouter(prefix="/v1/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="Stripe-Signature"),
    repository: ClaimRepository = Depends(get_claim_repository),
) -> dict[str, bool]:
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload,
            stripe_signature,
            get_settings().stripe_webhook_secret,
        )
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature") from exc
    if event["type"] in {"refund.updated", "refund.failed"}:
        refund = event["data"]["object"]
        claim_id = refund.get("metadata", {}).get("claim_id")
        if claim_id:
            claim = await repository.get_claim(claim_id)
            if claim:
                new_status = (
                    ClaimStatus.REFUNDED
                    if refund["status"] == "succeeded"
                    else ClaimStatus.REFUND_FAILED
                )
                if claim.status != new_status:
                    claim.status = new_status
                    await repository.replace_claim(claim)
                    settings = get_settings()
                    credential = DefaultAzureCredential()
                    try:
                        email_service = StatusEmailService(
                            settings.acs_email_endpoint,
                            settings.acs_sender_address,
                            credential,
                        )
                        await run_in_threadpool(
                            email_service.send,
                            claim.customer_email,
                            claim.id,
                            new_status.value,
                        )
                    finally:
                        credential.close()
    return {"received": True}