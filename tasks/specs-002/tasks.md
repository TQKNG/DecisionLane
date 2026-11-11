# Tasks: RefundFlow Evidence Understanding and Damage Validation

Input: spec/specs-002.md

Prerequisites: spec/specs-002.md, existing secure document-processing baseline, existing Foundry resource.

Tests: Required by the specification.

## Traceability

| Specification task | Spec Kit task | Task directory |
|---|---|---|
| EVID-01 | T001 | T001-create-analyzer |
| EVID-02 | T002 | T002-configure-content-understanding |
| EVID-03 | T003 | T003-add-classification-model |
| EVID-04 | T004 | T004-implement-classification-service |
| EVID-05 | T005 | T005-integrate-document-processing |
| EVID-06 | T007 | T007-validate-evidence-bundles |
| EVID-07 | T006 and T008 | T006-test-classification-service and T008-test-evidence-workflow |

## Phase 1: Setup

Purpose: Establish the Content Understanding analyzer contract and deployment inputs.

- [x] T001 [P] [US1] Create and validate the refund_evidence_classifier analyzer definition in infra/refund-evidence-classifier.json.
- [x] T002 [US1] Add Content Understanding settings, Bicep app settings, and managed-identity access after T001.

## Phase 2: Foundational

Purpose: Add the typed domain contract and service boundary required by all processing tasks.

- [ ] T003 [P] [US1] Add EvidenceClassification and ClaimDocument classification fields in backend/src/refundflow/domain/models.py.
- [ ] T004 [US1] Implement and register the Content Understanding service in backend/src/refundflow/services/content_understanding.py and backend/functions/services.py after T002 and T003.

Checkpoint: The analyzer, configuration, domain contract, and service client are ready before workflow integration.

## Phase 3: User Story 1 - Classify customer evidence

Goal: Classify PDF and image evidence and persist an auditable result.

- [ ] T005 [US1] Integrate Content Understanding classification into process_document in backend/function_app.py after T004.
- [ ] T006 [US1] Add Content Understanding service unit tests in backend/tests/unit/ after T004.

Independent test criteria:

- A clear damage image returns damage_photo with damage_visible true.
- An undamaged product image does not satisfy damage_photo.
- An unrelated or unreadable file is classified as other or unreadable.
- Malformed or unknown service output fails closed.

## Phase 4: User Story 2 - Validate claim evidence

Goal: Validate complete evidence bundles before human assessment.

- [ ] T007 [US2] Add deterministic claim-type evidence-bundle validation after T005 in backend/src/refundflow and backend/function_app.py.
- [ ] T008 [US2] Add evidence-bundle unit, integration, and end-to-end tests after T007 in backend/tests/ and tests/e2e/.

Independent test criteria:

- Damaged-item claims require purchase evidence and visible damage evidence.
- Wrong-item claims require purchase evidence and product or package-label evidence.
- Non-delivery and delayed-delivery claims require order and tracking evidence.
- Missing, unrelated, unreadable, or low-confidence evidence routes to needs_information or human review.
- No classifier result directly approves or pays a refund.

## Dependencies and execution order

### Phase dependencies

- Setup: T001 and T002.
- Foundational: T003 may run in parallel with T001, but T004 waits for T002 and T003.
- User Story 1: T005 and T006 wait for T004.
- User Story 2: T007 waits for T005, and T008 waits for T007.

### Parallel execution

The first wave can run T001 and T003 in parallel because they own different files.
The second wave is T002 after T001.
The third wave is T004 after T002 and T003.
T005 and T006 can run in parallel after T004 because the service implementation and its tests have separate ownership.

## Implementation strategy

1. Complete T001 and T003 as the initial parallel wave.
2. Complete T002 and T004 to establish the integration foundation.
3. Complete T005 and T006, then validate User Story 1 independently.
4. Complete T007 and T008, then validate User Story 2 end to end.
5. Run the full backend checks and the deployment verification commands from the specification.

## Completion report

Every completed task must record the baseline, owned files, changes, checks, evidence, integration needs, and unresolved issues.
The coordinator should mark a checklist item complete only after the task's independent test criteria pass.
