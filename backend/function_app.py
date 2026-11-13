from __future__ import annotations

import os
from datetime import timedelta
from functools import wraps

import azure.durable_functions as df
import azure.functions as func
from azure.identity import DefaultAzureCredential as SyncDefaultAzureCredential

from functions.services import ActivityServices
from refundflow.domain.evidence_validation import evaluate_evidence_bundle
from refundflow.domain.models import (
    AssessmentResult,
    ClaimAggregateItem,
    ClaimDocument,
    ClaimStatus,
    DocumentProcessingStatus,
    EvidenceBundle,
    EvidenceClassification,
    ExtractedDocument,
    RefundClaim,
    SafetyDecision,
)
from refundflow.observability import claim_span
from refundflow.repositories.orders import CosmosOrderRepository
from refundflow.services.email import StatusEmailService
from refundflow.services.malware import MalwareStatus
from refundflow.services.payments import StripeRefundService
from refundflow.workflows.assessment import run_assessment_workflow

local_auth_level = (
    func.AuthLevel.ANONYMOUS
    if os.getenv("APP_ENV") == "local"
    else func.AuthLevel.FUNCTION
)

app = df.DFApp(http_auth_level=local_auth_level)


def traced_activity(name: str, stage: str):
    def decorate(activity):
        @wraps(activity)
        async def wrapped(activity_input):
            with claim_span(name, activity_input["claim_id"], stage):
                return await activity(activity_input)

        return wrapped

    return decorate


@app.route(
    route="refund-workflows",
    methods=["POST"],
    auth_level=local_auth_level,
)
@app.durable_client_input(client_name="client")
async def start_refund_workflow(
    req: func.HttpRequest,
    client: df.DurableOrchestrationClient,
) -> func.HttpResponse:
    body = req.get_json()
    if not body.get("claim_id") or not body.get("document_ids"):
        return func.HttpResponse(
            "claim_id and document_ids are required",
            status_code=400,
        )
    instance_id = f"refund-workflow:{body['claim_id']}"

    # Reuse active workflows and recover failed workflows without duplicating work.
    existing = await client.get_status(instance_id, show_input=True)
    if existing:
        if existing.input_ != body:
            return func.HttpResponse(
                "A different workflow already exists for this claim",
                status_code=409,
            )

        if existing.runtime_status in {
            df.OrchestrationRuntimeStatus.Failed,
            df.OrchestrationRuntimeStatus.Terminated,
        }:
            await client.purge_instance_history(instance_id)
        else:
            return client.create_check_status_response(req, instance_id)

    try:
        await client.start_new(
            "refund_orchestrator",
            instance_id=instance_id,
            client_input=body,
        )
    except Exception:
        # Handles two requests racing to create the same workflow.
        existing = await client.get_status(instance_id)
        if not existing:
            raise

    return client.create_check_status_response(req, instance_id)

@app.route(
    route="refund-workflows/{instance_id}/approvals",
    methods=["POST"],
    auth_level=local_auth_level,
)
@app.durable_client_input(client_name="client")
async def signal_approval(
    req: func.HttpRequest,
    client: df.DurableOrchestrationClient,
) -> func.HttpResponse:
    instance_id = req.route_params["instance_id"]
    status = await client.get_status(instance_id)
    if status is None:
        return func.HttpResponse("Workflow not found", status_code=404)
    if status.runtime_status != df.OrchestrationRuntimeStatus.Running:
        return func.HttpResponse("Workflow is not waiting", status_code=409)
    body = req.get_json()
    required = {"claim_id", "reviewer_id", "reviewer_name", "decision", "comment"}
    if not required.issubset(body) or body["decision"] not in {"approve", "reject"}:
        return func.HttpResponse("Invalid approval payload", status_code=400)
    await client.raise_event(instance_id, "approval_received", body)
    return func.HttpResponse(status_code=202)

@app.orchestration_trigger(context_name="context")
def refund_orchestrator(context: df.DurableOrchestrationContext):
    workflow_input = context.get_input()
    claim_id = workflow_input["claim_id"]
    document_ids = workflow_input["document_ids"]
    yield context.call_activity(
        "set_claim_status",
        {"claim_id": claim_id, "status": ClaimStatus.SCANNING.value},
    )

    for document_id in document_ids:
        scan_deadline = context.current_utc_datetime + timedelta(minutes=30)
        while True:
            scan_status = yield context.call_activity(
                "check_malware_status",
                {"claim_id": claim_id, "document_id": document_id},
            )
            if scan_status == MalwareStatus.CLEAN.value:
                break
            if scan_status in {MalwareStatus.MALICIOUS.value, MalwareStatus.ERROR.value}:
                yield context.call_activity(
                    "reject_document",
                    {
                        "claim_id": claim_id,
                        "document_id": document_id,
                        "reason": scan_status,
                    },
                )
                return {"status": "rejected", "reason": scan_status}
            if context.current_utc_datetime >= scan_deadline:
                yield context.call_activity(
                    "set_claim_status",
                    {"claim_id": claim_id, "status": ClaimStatus.NEEDS_INFORMATION.value},
                )
                return {"status": "timed_out", "reason": "malware_scan_timeout"}
            next_check = context.current_utc_datetime + timedelta(seconds=30)
            yield context.create_timer(next_check)

    yield context.call_activity(
        "set_claim_status",
        {"claim_id": claim_id, "status": ClaimStatus.PROCESSING.value},
    )
    requires_safety_review = False
    classifications: dict[str, object] = {}
    extractions: dict[str, object] = {}
    safety_decisions: dict[str, str] = {}
    for document_id in document_ids:
        result = yield context.call_activity(
            "process_document",
            {"claim_id": claim_id, "document_id": document_id},
        )
        if result["decision"] == SafetyDecision.BLOCK.value:
            yield context.call_activity(
                "set_claim_status",
                {"claim_id": claim_id, "status": ClaimStatus.REJECTED.value},
            )
            return {"status": "rejected", "reason": "content_safety_block"}
        if result["decision"] == SafetyDecision.REVIEW.value:
            requires_safety_review = True
        safety_decisions[document_id] = str(result["decision"])
        if result.get("classification") is not None:
            classifications[document_id] = result["classification"]
        if result.get("document") is not None:
            extractions[document_id] = result["document"]

    validation = yield context.call_activity(
        "validate_evidence_bundle",
        {
            "claim_id": claim_id,
            "classifications": classifications,
            "extractions": extractions,
            "safety_decisions": safety_decisions,
        },
    )

    if validation["status"] == "rejected":
        yield context.call_activity(
            "set_claim_status",
            {"claim_id": claim_id, "status": ClaimStatus.REJECTED.value},
        )
        return validation

    if validation["status"] == "needs_information":
        yield context.call_activity(
            "set_claim_status",
            {"claim_id": claim_id, "status": ClaimStatus.NEEDS_INFORMATION.value},
        )
        return validation

    if validation["status"] == "human_review":
        yield context.call_activity(
            "set_claim_status",
            {"claim_id": claim_id, "status": ClaimStatus.PENDING_APPROVAL.value},
        )
    else:
        yield context.call_activity(
            "promote_documents",
            {
                "claim_id": claim_id,
                "document_ids": validation["document_ids"],
            },
        )

    extracted_documents = list(extractions.values())

    assessment = yield context.call_activity(
        "assess_claim",
        {
            "claim_id": claim_id,
            "documents": extracted_documents,
            "requires_safety_review": requires_safety_review,
        },
    )
    yield context.call_activity(
        "set_claim_status",
        {"claim_id": claim_id, "status": ClaimStatus.PENDING_APPROVAL.value},
    )

    required_approvals = 2 if assessment["requires_two_reviewers"] else 1
    reviewer_ids: list[str] = []
    approval_deadline = context.current_utc_datetime + timedelta(days=7)
    while len(reviewer_ids) < required_approvals:
        approval_task = context.wait_for_external_event("approval_received")
        timeout_task = context.create_timer(approval_deadline)
        winner = yield context.task_any([approval_task, timeout_task])
        if winner == timeout_task:
            yield context.call_activity(
                "set_claim_status",
                {"claim_id": claim_id, "status": ClaimStatus.CLOSED.value},
            )
            return {"status": "closed", "reason": "approval_timeout"}
        timeout_task.cancel()
        decision = approval_task.result
        if decision["reviewer_id"] in reviewer_ids:
            continue
        yield context.call_activity("record_approval", decision)
        if decision["decision"] == "reject":
            yield context.call_activity(
                "set_claim_status",
                {"claim_id": claim_id, "status": ClaimStatus.REJECTED.value},
            )
            yield context.call_activity(
                "send_status_email",
                {"claim_id": claim_id, "status": "rejected"},
            )
            return {"status": "rejected", "reason": "reviewer_rejected"}
        reviewer_ids.append(decision["reviewer_id"])

    yield context.call_activity(
        "set_claim_status",
        {"claim_id": claim_id, "status": ClaimStatus.APPROVED.value},
    )
    refund = yield context.call_activity_with_retry(
        "execute_refund",
        df.RetryOptions(first_retry_interval_in_milliseconds=5000, max_number_of_attempts=3),
        {"claim_id": claim_id, "assessment": assessment},
    )
    yield context.call_activity(
        "set_claim_status",
        {"claim_id": claim_id, "status": ClaimStatus.REFUND_SUBMITTED.value},
    )
    yield context.call_activity(
        "send_status_email",
        {"claim_id": claim_id, "status": "refund_submitted"},
    )
    return {"status": "refund_submitted", "refund": refund}


async def load_claim_and_document(
    services: ActivityServices,
    claim_id: str,
    document_id: str,
) -> tuple[RefundClaim, ClaimAggregateItem, ClaimDocument]:
    claim = await services.repository.get_claim(claim_id)
    if claim is None:
        raise ValueError(f"Claim {claim_id} does not exist")
    items = await services.repository.list_items(claim_id, "document")
    item = next((value for value in items if value.payload["id"] == document_id), None)
    if item is None:
        raise ValueError(f"Document {document_id} does not exist")
    return claim, item, ClaimDocument.model_validate(item.payload)


@app.activity_trigger(input_name="activity_input")
@traced_activity("refundflow.validate_evidence_bundle", "evidence_validation")
async def validate_evidence_bundle(activity_input) -> dict[str, object]:
    services = ActivityServices()
    try:
        claim = await services.repository.get_claim(str(activity_input["claim_id"]))
        if claim is None:
            raise ValueError("Claim not found")

        classifications = {
            str(document_id): EvidenceClassification.model_validate(value)
            for document_id, value in activity_input["classifications"].items()
        }
        extractions = {
            str(document_id): ExtractedDocument.model_validate(value)
            for document_id, value in activity_input["extractions"].items()
        }
        safety_decisions = {
            str(document_id): str(decision)
            for document_id, decision in activity_input["safety_decisions"].items()
        }
        validation = evaluate_evidence_bundle(
            claim.claim_type,
            classifications,
            extractions,
            safety_decisions,
        )
        payload = {
            "status": validation.status.value,
            "reasons": list(validation.reasons),
            "document_ids": list(validation.document_ids),
        }
        await services.repository.upsert_item(
            ClaimAggregateItem(
                id="evidence-validation",
                claim_id=claim.id,
                item_type="evidence_validation",
                payload=payload,
            )
        )
        return payload
    finally:
        await services.close()


@app.activity_trigger(input_name="activity_input")
@traced_activity("refundflow.check_malware_status", "malware_scanning")
async def check_malware_status(activity_input) -> str:
    services = ActivityServices()
    try:
        _, _, document = await load_claim_and_document(
            services,
            activity_input["claim_id"],
            activity_input["document_id"],
        )
        return (await services.malware.get_status(document.blob_name)).value
    finally:
        await services.close()


@app.activity_trigger(input_name="activity_input")
@traced_activity("refundflow.reject_document", "document_rejection")
async def reject_document(activity_input) -> None:
    services = ActivityServices()
    try:
        claim, item, document = await load_claim_and_document(
            services,
            activity_input["claim_id"],
            activity_input["document_id"],
        )
        document.status = DocumentProcessingStatus.MALWARE_REJECTED
        item.payload = document.model_dump(mode="json")
        await services.repository.upsert_item(item)
        claim.status = ClaimStatus.REJECTED
        await services.repository.replace_claim(claim)
    finally:
        await services.close()


# Main Flow - Plug-in business logic
@app.activity_trigger(input_name="activity_input")
@traced_activity("refundflow.process_document", "document_processing")
async def process_document(activity_input) -> dict[str, object]:
    services = ActivityServices()
    try:
        _, item, document = await load_claim_and_document(
            services,
            activity_input["claim_id"],
            activity_input["document_id"],
        )

        # Run Content Safety before Content Understanding classification.
        content = await services.evidence_storage.download_quarantined(document.blob_name)
        safety = await services.content_safety.analyze(content, document.content_type)

        if safety.decision == SafetyDecision.BLOCK:
            document.status = DocumentProcessingStatus.SAFETY_BLOCKED
            item.payload = document.model_dump(mode="json")
            await services.repository.upsert_item(item)
            return {"decision": safety.decision.value, "document": None}

        classification = await services.content_understanding.analyze(
            content,
            document.content_type,
        )

        extracted = await services.extraction.extract(
            document.id,
            document.file_name,
            document.content_type,
            content,
            safety,
        )

        document.evidence_type = classification.evidence_type
        document.evidence_confidence = classification.confidence
        document.evidence_validation = classification.validation_status
        document.damage_visible = classification.damage_visible
        document.image_quality = classification.image_quality
        document.classification_reason = classification.reason
        document.status = (
            DocumentProcessingStatus.SAFETY_REVIEW_REQUIRED
            if safety.decision == SafetyDecision.REVIEW
            else DocumentProcessingStatus.EXTRACTION_COMPLETE
        )

        item.payload = document.model_dump(mode="json")
        await services.repository.upsert_item(item)

        # For reviewer summary
        await services.repository.upsert_item(
            ClaimAggregateItem(
                id=f"classification:{document.id}",
                claim_id=document.claim_id,
                item_type="classification",
                payload=classification.model_dump(mode="json"),
            )
        )

        await services.repository.upsert_item(
            ClaimAggregateItem(
                id=f"extraction:{document.id}",
                claim_id=document.claim_id,
                item_type="extraction",
                payload=extracted.model_dump(mode="json"),
            )
        )
        return {
            "decision": safety.decision.value,
            "classification": classification.model_dump(mode="json"),
            "document": extracted.model_dump(mode="json"),
            "promotable": False,
        }
    finally:
        await services.close()

# Promotion evidence only after the rubric passes
@app.activity_trigger(input_name="activity_input")
async def promote_documents(activity_input) -> None:
    services = ActivityServices()
    try:
        for document_id in activity_input["document_ids"]:
            _, item, document = await load_claim_and_document(
                services,
                activity_input["claim_id"],
                document_id,
            )

            content = await services.evidence_storage.download_quarantined(
                document.blob_name
            )
            await services.evidence_storage.promote(
                document.blob_name,
                content,
                document.content_type,
            )

            document.status = DocumentProcessingStatus.EXTRACTION_COMPLETE
            item.payload = document.model_dump(mode="json")
            await services.repository.upsert_item(item)
    finally:
        await services.close()

@app.activity_trigger(input_name="activity_input")
@traced_activity("refundflow.assess_claim", "claim_assessment")
async def assess_claim(activity_input) -> dict[str, object]:
    services = ActivityServices()
    try:
        claim = await services.repository.get_claim(str(activity_input["claim_id"]))
        if claim is None:
            raise ValueError("Claim not found")
        documents = [
            ExtractedDocument.model_validate(value)
            for value in activity_input["documents"]
        ]
        assessment = await run_assessment_workflow(
            services.settings,
            services.policy_search,
            EvidenceBundle(claim=claim, documents=documents),
        )
        if bool(activity_input["requires_safety_review"]):
            assessment.eligible = False
            assessment.summary = f"Content safety review required. {assessment.summary}"
        await services.repository.upsert_item(
            ClaimAggregateItem(
                id=f"assessment:{claim.id}",
                claim_id=claim.id,
                item_type="assessment",
                payload=assessment.model_dump(mode="json"),
            )
        )
        return assessment.model_dump(mode="json")
    finally:
        await services.close()


@app.activity_trigger(input_name="activity_input")
@traced_activity("refundflow.set_claim_status", "claim_status_update")
async def set_claim_status(activity_input) -> None:
    services = ActivityServices()
    try:
        claim = await services.repository.get_claim(activity_input["claim_id"])
        if claim is None:
            raise ValueError("Claim not found")
        claim.status = ClaimStatus(activity_input["status"])
        await services.repository.replace_claim(claim)
    finally:
        await services.close()


@app.activity_trigger(input_name="activity_input")
@traced_activity("refundflow.record_approval", "approval_recording")
async def record_approval(activity_input) -> None:
    services = ActivityServices()
    try:
        claim_id = activity_input["claim_id"]
        reviewer_id = activity_input["reviewer_id"]
        await services.repository.append_item(
            ClaimAggregateItem(
                id=f"approval:{reviewer_id}",
                claim_id=claim_id,
                item_type="approval",
                payload=activity_input,
            )
        )
    finally:
        await services.close()

@app.activity_trigger(input_name="activity_input")
@traced_activity("refundflow.execute_refund", "refund_execution")
async def execute_refund(activity_input) -> dict[str, object]:
    services = ActivityServices()
    order_repository = CosmosOrderRepository(
        services.settings.cosmos_endpoint,
        services.settings.cosmos_database,
        services.credential
    )
    try:
        claim = await services.repository.get_claim(str(activity_input["claim_id"]))
        if claim is None:
            raise ValueError("Claim not found")
        assessment = AssessmentResult.model_validate(activity_input["assessment"])
        order = await order_repository.get_order(claim.customer_id, claim.order_id)
        if order is None:
            raise ValueError("Order not found")
        if assessment.proposed_refund_amount > order.paid_amount:
            raise ValueError("Proposed amount exceeds paid amount")
        payment_service = StripeRefundService(os.environ["STRIPE_SECRET_KEY"])
        result = payment_service.create_refund(
            claim.id,
            order.payment_intent_id,
            assessment.proposed_refund_amount,
            order.currency
        )
        await services.repository.upsert_item(
            ClaimAggregateItem(
                id=f"refund:{claim.id}",
                claim_id=claim.id,
                item_type="refund",
                payload=result
            )
        )
        return result
    finally:
        await order_repository.close()
        await services.close()


@app.activity_trigger(input_name="activity_input")
@traced_activity("refundflow.send_status_email", "status_notification")
async def send_status_email(activity_input) -> None:
    services = ActivityServices()
    try:
        claim = await services.repository.get_claim(activity_input["claim_id"])
        if claim is None:
            raise ValueError("Claim not found")
        email_credential = SyncDefaultAzureCredential()
        email_service = StatusEmailService(
            os.environ["ACS_EMAIL_ENDPOINT"],
            os.environ["ACS_SENDER_ADDRESS"],
            email_credential
        )
        try:
            email_service.send(claim.customer_email, claim.id, activity_input["status"])
        finally:
            email_credential.close()
    finally:
        await services.close()
