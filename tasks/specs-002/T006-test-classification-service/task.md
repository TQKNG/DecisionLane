# T006: Test evidence classification

Status: ready
Story: US1 - Classify customer evidence
Parallelizable: yes
Depends on: T004
Owned files: backend/tests/unit/test_content_understanding_service.py, backend/tests/fixtures/

## Objective

Prove that the classifier contract handles representative evidence and unsafe or ambiguous outputs.

## Implementation

Add fixture metadata or small test fixtures for a receipt PDF, invoice image, clear damage image, undamaged product image, unrelated image, tracking screenshot, and unreadable image.
Mock the service boundary for unit tests.
Cover valid categories, damage_visible behavior, confidence boundaries, malformed output, and unknown categories.

## Acceptance criteria

- Tests run without Azure credentials or network access.
- Clear damage evidence is distinguished from an undamaged product image.
- Unrelated and unreadable evidence cannot satisfy a valid evidence category.
- Low confidence remains reviewable.

## Verification

Run the focused tests, then the complete backend unit suite.
Record any fixture limitations that prevent real-service validation.

## Handoff

Report fixture names, test coverage, commands, and any remaining need for live analyzer verification.
