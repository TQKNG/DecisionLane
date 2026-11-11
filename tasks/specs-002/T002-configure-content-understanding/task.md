# T002: Configure Content Understanding deployment

Status: completed
Story: US1 - Classify customer evidence
Parallelizable: no
Depends on: T001
Owned files: backend/src/refundflow/config.py, infra/main.bicep, infra/foundry-role-assignments.bicep, backend/local.settings.example.json

## Objective

Make the analyzer endpoint, analyzer ID, and API version available to both the API and Durable Functions workloads.

## Implementation

Add content_understanding_endpoint, content_understanding_analyzer_id, and content_understanding_api_version to Settings.
Add matching local settings.
Add matching app settings to infra/main.bicep for the API and Function App.
Do not edit infra/main.json manually.
Grant the API and Function App managed identities the required Cognitive Services User role on the existing Foundry resource.

## Acceptance criteria

- Both workloads receive the same endpoint, analyzer ID, and API version.
- The analyzer ID defaults to refund_evidence_classifier.
- Infrastructure remains based on the existing Foundry resource.
- Bicep validation succeeds.
- Managed-identity access is documented and verifiable.

## Verification

Run az bicep build --file infra/main.bicep.
Run deployment validation or what-if.
Inspect the deployed application settings without printing secrets.
Verify the role assignments for both workload identities.

## Handoff

Report the Bicep validation result, changed app settings, resource ID used for role assignment, and any propagation delay.
