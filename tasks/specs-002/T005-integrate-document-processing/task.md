# T005: Integrate evidence classification into document processing

Status: ready
Story: US1 - Classify customer evidence
Parallelizable: no
Depends on: T004
Owned files: backend/function_app.py, backend/src/refundflow/domain/models.py, backend/tests/unit/test_document_processing.py

## Objective

Run Content Understanding in the secure document-processing activity and persist an auditable result.

## Implementation

Call Content Understanding after Content Safety passes and before evidence promotion.
Continue using Document Intelligence for current layout extraction.
Persist the classification summary on ClaimDocument.
Persist the complete classification as a ClaimAggregateItem with a stable ID such as classification:{document_id}.
Keep blocked files in quarantine.
Keep low-confidence files available for reviewer inspection.

## Acceptance criteria

- Content Safety blocks still stop processing before classification.
- Classification runs before clean evidence promotion.
- Classification and extraction records are persisted with the claim and document IDs.
- A low-confidence result does not automatically approve or reject a claim.
- Activity resources are closed on success and failure.

## Verification

Test the block, pass, review, malformed-output, and service-error paths.
Verify Cosmos payloads contain document, classification, confidence, and reason data without raw sensitive content in telemetry.

## Handoff

Report changed activity order, persistence IDs, failure behavior, and evidence for T006 and T007.
