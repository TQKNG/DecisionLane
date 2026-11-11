# T004: Implement and register the Content Understanding service

Status: ready
Story: US1 - Classify customer evidence
Parallelizable: no
Depends on: T002, T003
Owned files: backend/src/refundflow/services/content_understanding.py, backend/functions/services.py, backend/tests/unit/test_content_understanding_service.py

## Objective

Add an authenticated, testable service boundary for Content Understanding.

## Implementation

Create ContentUnderstandingService with asynchronous analyze and close methods.
Authenticate with DefaultAzureCredential.
Use the configured endpoint, analyzer ID, and API version.
Send PDF or image bytes to the analyzer.
Validate the response into EvidenceClassification.
Fail closed on malformed output, unknown categories, or missing required damage fields.
Instantiate and close the service in ActivityServices.

## Acceptance criteria

- The service has no global mutable client shared across activity invocations.
- Valid service output maps to EvidenceClassification.
- Invalid output raises a controlled processing error.
- The service closes its client and credential resources correctly.
- Unit tests do not call Azure.

## Verification

Mock successful, malformed, unknown-category, timeout, and authorization-error responses.
Run the focused service tests and backend lint and type checks.

## Handoff

Report the service interface, authentication method, mocked response coverage, and integration instructions for T005.
