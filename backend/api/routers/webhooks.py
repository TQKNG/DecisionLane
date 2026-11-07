from __future__ import annotations

from typing import Annotated, Literal

import stripe
from azure.identity import DefaultAzureCredential
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from api.dependencies import get_claim_repository
from api.responses import error_responses
from refundflow.config import get_settings
from refundflow.domain.models import ClaimStatus
from refundflow.repositories.claims import ClaimRepository
from refundflow.services.email import StatusEmailService

router = APIRouter(prefix="/v1/webhooks", tags=["webhooks"])

ClaimRepositoryDep = Annotated[
    ClaimRepository,
    Depends(get_claim_repository),
]


class StripeWebhookResponse(BaseModel):
    received: Literal[True]


@router.post(
    "/stripe",
    response_model=StripeWebhookResponse,
    operation_id="receive_stripe_webhook",
    summary="Receive a Stripe refund event",
    description=(
        "Accepts a Stripe webhook only after verifying its signature against the "
        "configured webhook secret. This endpoint uses Stripe-Signature, not Entra bearer auth."
    ),
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "description": (
                            "Stripe event payload. The signature is verified against the "
                            "exact request bytes."
                        ),
                        "additionalProperties": True,
                    }
                }
            },
        }
    },
    responses=error_responses(400),
)
async def stripe_webhook(
    request: Request,
    stripe_signature: Annotated[str, Header(alias="Stripe-Signature")],
    repository: ClaimRepositoryDep,
) -> StripeWebhookResponse:
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
    return StripeWebhookResponse(received=True)
