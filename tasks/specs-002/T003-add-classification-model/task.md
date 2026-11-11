# T003: Add the evidence classification contract

Status: ready
Story: US1 - Classify customer evidence
Parallelizable: yes
Depends on: none
Owned files: backend/src/refundflow/domain/models.py, backend/tests/unit/test_evidence_classification.py

## Objective

Create the typed contract that represents Content Understanding output and its persisted document summary.

## Implementation

Add EvidenceClassification with evidence_type, confidence, image_quality, shows_product, damage_visible, damage_type, reason, and validation_status.
Constrain confidence to the range 0 through 1.
Add evidence_type, evidence_confidence, and evidence_validation to ClaimDocument.
Add unit tests for valid and invalid model values.

## Acceptance criteria

- The model rejects confidence values outside the allowed range.
- Optional damage fields support non-image evidence.
- The document model can persist classification summary fields.
- The contract contains no raw image bytes or secrets.

## Verification

Run the focused classification model tests.
Run the existing domain and API tests that serialize ClaimDocument.

## Handoff

Report the model fields, serialization behavior, test results, and any compatibility concerns for existing Cosmos items.
