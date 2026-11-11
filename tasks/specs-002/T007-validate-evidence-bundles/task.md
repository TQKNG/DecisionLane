# T007: Validate claim-type evidence bundles

Status: ready
Story: US2 - Validate claim evidence
Parallelizable: no
Depends on: T005
Owned files: backend/src/refundflow/domain/evidence_validation.py, backend/function_app.py, backend/tests/unit/test_evidence_validation.py

## Objective

Enforce deterministic minimum evidence requirements before the claim enters human assessment.

## Implementation

Add a pure validator that accepts claim type and classified documents.
For damaged_item, require receipt or invoice plus damage_photo with damage_visible true.
For wrong_item, require purchase evidence plus product_photo or package_label.
For non_delivery and delayed_delivery, require order evidence plus tracking_evidence.
Route incomplete, unrelated, unreadable, or below-threshold evidence to needs_information.
Persist a reviewer-readable reason.

## Acceptance criteria

- Every supported claim type has a deterministic rule.
- Receipt and invoice are alternatives where specified.
- A damage image without visible damage does not satisfy damaged_item.
- Low-confidence evidence is not treated as automatic approval.
- Validation is independent of Azure and unit-testable.

## Verification

Test complete, incomplete, unrelated, unreadable, and low-confidence bundles for every claim type.
Verify no payment or approval side effect occurs during validation.

## Handoff

Report the rule matrix, status transition behavior, persistence shape, and integration requirements for T008.
