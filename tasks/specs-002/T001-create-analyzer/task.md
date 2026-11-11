# T001: Create the Content Understanding classifier

Status: completed
Story: US1 - Classify customer evidence
Parallelizable: yes
Depends on: none
Owned files: infra/refund-evidence-classifier.json

## Objective

Create the Content Understanding analyzer definition for RefundFlow evidence.

## Inputs

- spec/specs-002.md sections 2, 3, and 5.1.
- Official Content Understanding classifier documentation.
- Existing Foundry resource configuration from GUIDE.md section 9.

## Implementation

Create an analyzer named refund_evidence_classifier.
Support receipt, invoice, order_confirmation, tracking_evidence, damage_photo, product_photo, package_label, unreadable, and other categories.
For damage_photo, return damage_visible, damage_type, image_quality, confidence, and reason.
Include an explicit other category so unrelated files are not forced into a valid evidence category.
Use the production API version 2025-11-01.

## Acceptance criteria

- The analyzer definition is valid for the selected Content Understanding API version.
- The analyzer accepts the PDF and image inputs supported by the current upload contract.
- The analyzer returns structured fields for damage-photo analysis.
- The analyzer can be created or updated without editing application source files.

## Verification

Create or validate the analyzer using Content Understanding Studio or the documented REST command.
Run representative receipt, invoice, damage, undamaged, tracking, unrelated, and unreadable fixtures.
Record analyzer ID, API version, result category, confidence, and any service limitations.

## Handoff

Report the analyzer ID, deployed API version, validation results, and any schema changes required by T002 or T004.
