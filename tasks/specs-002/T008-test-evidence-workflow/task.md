# T008: Verify the evidence workflow end to end

Status: ready
Story: US2 - Validate claim evidence
Parallelizable: no
Depends on: T006, T007
Owned files: backend/tests/integration/, tests/e2e/, evaluation fixtures

## Objective

Verify the complete evidence-classification and claim-validation workflow against the specification.

## Implementation

Add integration tests for the service and persistence boundaries.
Extend the existing happy path with receipt plus clear damage image.
Add negative scenarios for unrelated image, unreadable image, missing receipt, missing tracking evidence, and low-confidence damage image.
Verify no refund is created for incomplete evidence.

## Acceptance criteria

- A complete damaged-item bundle reaches human review.
- An unrelated or incomplete bundle reaches needs_information.
- A low-confidence image remains in the reviewable path.
- Classification and extraction items are written to Cosmos DB.
- Existing clean evidence promotion and assessment behavior remains intact.

## Verification

Run:

~~~bash
az bicep build --file infra/main.bicep
cd backend
source .venv/bin/activate
python -m pip install --no-deps --editable .
ruff check .
mypy src api
pytest -q
cd ..
~~~

Run the live analyzer validation only in an approved development environment.
Record analyzer version, fixture ID, classification, confidence, latency, final status, and unresolved limitations.

## Handoff

Report the full command output summary, passed scenarios, failed scenarios, generated artifacts, and remaining production risks.
