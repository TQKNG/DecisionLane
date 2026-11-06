from __future__ import annotations

import asyncio
import json
import os
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

from agent_framework import EvalItem, Message
from agent_framework.foundry import FoundryChatClient, FoundryEvals
from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import DefaultAzureCredential
from functions.services import ActivityServices
from refundflow.config import get_settings
from refundflow.domain.models import (
    AssessmentResult,
    ClaimType,
    EvidenceBundle,
    ExtractedDocument,
    RefundClaim,
    SafetyAnalysis,
    SafetyDecision,
)
from refundflow.workflows.assessment import build_assessment_workflow


def make_policy_query(evidence: EvidenceBundle) -> str:
    claim = evidence.claim
    return (
        f"Refund requirements for {claim.claim_type.value}. "
        f"Requested amount {claim.requested_amount} {claim.currency}. "
        f"Reason: {claim.reason}"
    )


def make_eval_item(
    evidence: EvidenceBundle,
    assessment: AssessmentResult,
    policy_context: str,
) -> EvalItem:
    claim = evidence.claim
    query = (
        f"Assess refund claim {claim.id} for {claim.claim_type.value}. "
        f"Requested amount: {claim.requested_amount} {claim.currency}. "
        f"Reason: {claim.reason}\n"
        f"Evidence: {' '.join(document.text for document in evidence.documents)}"
    )
    response = assessment.model_dump_json(indent=2)
    return EvalItem(
        conversation=[
            Message("user", [query]),
            Message("assistant", [response]),
        ],
        context=policy_context,
    )


def make_evidence(row: dict[str, object]) -> EvidenceBundle:
    claim = RefundClaim(
        id=str(row["case_id"]),
        customer_id="evaluation-user",
        customer_email="evaluation@example.com",
        order_id=f"order-{row['case_id']}",
        claim_type=ClaimType(str(row["claim_type"])),
        reason=str(row["reason"]),
        requested_amount=Decimal(str(row["amount"])),
    )
    document = ExtractedDocument(
        document_id=f"document-{row['case_id']}",
        file_name="evaluation.txt",
        content_type="image/png",
        page_count=1,
        text=str(row["evidence_text"]),
        safety=SafetyAnalysis(decision=SafetyDecision.PASS, severities={}),
    )
    return EvidenceBundle(claim=claim, documents=[document])


async def main() -> None:
    case_count = int(os.getenv("EVAL_CASE_COUNT", "5"))
    offset = int(os.getenv("EVAL_OFFSET", "0"))
    rows = [json.loads(line) for line in Path("evals/datasets/refund-cases-v1.jsonl").read_text().splitlines()]
    selected = [rows[(offset + index) % len(rows)] for index in range(case_count)]
    settings = get_settings()
    services = ActivityServices()
    credential = DefaultAzureCredential()
    project_client = AIProjectClient(settings.foundry_project_endpoint, credential)
    judge_client = FoundryChatClient(
        project_endpoint=settings.foundry_project_endpoint,
        model=settings.foundry_evaluation_model,
        credential=credential,
    )
    foundry_evals = FoundryEvals(
        client=judge_client,
        evaluators=[
            FoundryEvals.RELEVANCE,
            FoundryEvals.GROUNDEDNESS,
            FoundryEvals.COHERENCE,
            FoundryEvals.HATE_UNFAIRNESS,
        ],
    )
    summaries = []
    failures = []
    try:
        for row in selected:
            evidence = make_evidence(row)
            policy_citations = await services.policy_search.search(
                make_policy_query(evidence),
                top=5,
            )
            if not policy_citations:
                raise ValueError(f"No refund policy passages were retrieved for {row['case_id']}")
            policy_context = "\n\n".join(
                f"[{citation.chunk_id}] {citation.title}\n{citation.quote}"
                for citation in policy_citations
            )
            workflow = build_assessment_workflow(settings, services.policy_search)
            workflow_result = await workflow.run(evidence)
            outputs = workflow_result.get_outputs()
            if len(outputs) != 1:
                raise RuntimeError(
                    f"Expected one assessment output for {row['case_id']}, received {len(outputs)}"
                )
            result = await foundry_evals.evaluate(
                [
                    make_eval_item(
                        evidence,
                        outputs[0],
                        policy_context,
                    )
                ],
                eval_name=f"Refund assessment {row['case_id']}",
            )
            summaries.append(
                {
                    "case_id": row["case_id"],
                    "provider": result.provider,
                    "eval_id": result.eval_id,
                    "run_id": result.run_id,
                    "status": result.status,
                    "passed": result.passed,
                    "failed": result.failed,
                    "total": result.total,
                    "report_url": result.report_url,
                    "error": result.error,
                    "per_evaluator": result.per_evaluator,
                }
            )
            if not result.all_passed:
                failures.append(
                    f"{row['case_id']}: eval {result.eval_id}, run {result.run_id}, "
                    f"status={result.status}, error={result.error or 'not provided'}"
                )
    finally:
        try:
            await judge_client.close()
        finally:
            try:
                await project_client.close()
            finally:
                try:
                    await services.close()
                finally:
                    await credential.close()

    output = Path("evals/results") / f"foundry-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(summaries, indent=2), encoding="utf-8")
    print(output)
    if failures:
        raise RuntimeError("Foundry evaluation failed:\n" + "\n".join(failures))


if __name__ == "__main__":
    asyncio.run(main())