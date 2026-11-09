# Specification: RefundFlow OpenAPI Contract

## 1. Metadata

| Field | Value |
|---|---|
| ID | openapi-api |
| Status | completed |
| Type | API contract and publication |
| Scope | FastAPI application and checked-in OpenAPI artifact |
| Primary implementation | backend/api/main.py, routers, Pydantic models |
| Generated artifact | backend/openapi/openapi.json |
| Dependencies | Entra authorization, Stripe webhook verification, existing API routes |

## 2. Context

FastAPI is the source of truth for the RefundFlow HTTP contract.
The running application must generate the OpenAPI schema from its routes and Pydantic models.
The checked-in schema is used by Postman, review tooling, and contract checks.

The browser's direct upload to the Azure Blob SAS URL is not part of the RefundFlow API contract.
The API only creates the upload grant and verifies completion.

## 3. Goals and non-goals

### Goals

- Publish an accurate OpenAPI 3.x document from the running FastAPI application.
- Expose /openapi.json, /docs, and /redoc in local, staging, and production environments.
- Check in a reproducible schema at backend/openapi/openapi.json.
- Document operation IDs, tags, request and response models, status codes, authentication, and role requirements.
- Detect stale generated artifacts in tests and CI.
- Make the contract easy to import into Postman and future generated clients.

### Non-goals

- Changing API business behavior.
- Replacing Entra token validation.
- Adding Azure Blob Storage's signed upload endpoint to the API schema.
- Treating Entra app roles as OAuth scopes.
- Exposing internal Durable Functions workflow endpoints as customer API operations.

## 4. Current state and requirements

### 4.1 API identity

- OpenAPI title: RefundFlow API.
- info.version: 0.1.0 until an explicit versioning decision is made.
- Resource routes remain under /v1.
- Health checks remain at /health/live and /health/ready.
- A breaking contract change requires an explicit API versioning decision.

### 4.2 Publication

| Path | Requirement |
|---|---|
| /openapi.json | Generated, downloadable JSON schema |
| /docs | Swagger UI backed by /openapi.json |
| /redoc | ReDoc backed by /openapi.json |

The checked-in document must be regenerated from api.main:app.
It must not be edited by hand.
The running schema and checked-in artifact must be semantically equivalent.

### 4.3 Contract conventions

- Every operation has a stable, unique operationId.
- Every operation has a concise summary, useful description, explicit tag, success response, and known error responses.
- Parameters include accurate names, types, optionality, constraints, and examples where useful.
- Error responses use FastAPI's current {"detail": "..."} shape.
- Response schemas match the serialized Pydantic models.
- Examples are synthetic and contain no secrets, personal data, or signed URLs.
- Tags are health, claims, uploads, reviews, admin, and webhooks.

### 4.4 Authentication

Protected operations use an HTTP bearer security scheme with bearer format JWT.
Deployed requests use an Entra access token for the RefundFlow API audience.
Authorization is enforced with the Entra roles claim.
The schema must list the minimum required roles for each protected operation.

Health checks are public.
The Stripe webhook uses a required Stripe-Signature header and signature verification.
The webhook must not declare bearer-token security.

### 4.5 Operation inventory

| Method | Path | Tag | Access | Success |
|---|---|---|---|---|
| GET | /health/live | health | Public | 200 |
| GET | /health/ready | health | Public | 200 |
| POST | /v1/claims | claims | Customer | 201 |
| GET | /v1/claims | claims | Customer, Reviewer, Admin | 200 |
| GET | /v1/claims/{claim_id} | claims | Customer, Reviewer, Admin | 200 |
| POST | /v1/claims/{claim_id}/uploads | uploads | Customer | 200 |
| POST | /v1/claims/{claim_id}/uploads/{document_id}/complete | uploads | Customer | 202 |
| POST | /v1/claims/{claim_id}/submit | uploads | Customer | 202 |
| GET | /v1/reviews/{claim_id} | reviews | Reviewer, Admin | 200 |
| POST | /v1/reviews/{claim_id}/decision | reviews | Reviewer, Admin | 202 |
| GET | /v1/admin/kpis | admin | Admin | 200 |
| POST | /v1/webhooks/stripe | webhooks | Stripe-Signature | 200 |

Document the actual request and response models for every operation.
Document applicable 400, 401, 403, 404, 409, and 422 outcomes.
Do not add unimplemented operations.

## 5. Implementation plan

### 5.1 Define schema metadata

Update the FastAPI application metadata, tag descriptions, and security scheme in backend/api/main.py.
Keep route behavior unchanged.

### 5.2 Improve route metadata

Review every router under backend/api/routers/.
Add or correct operation IDs, summaries, descriptions, tags, response models, status codes, and error responses.
Ensure GET /v1/claims documents the status query parameter.

### 5.3 Generate the checked-in artifact

Add a repeatable generation command that imports api.main:app and writes backend/openapi/openapi.json.
The command must fail when the application cannot produce a schema.
Document Postman import from the running /openapi.json endpoint and the checked-in artifact.

### 5.4 Add contract tests

Add tests under backend/tests/ that call the application without Azure credentials or network access.
Keep existing endpoint behavior tests.
Contract tests supplement rather than replace route tests.

## 6. Task breakdown

| Task | Depends on | Owned files | Completion evidence |
|---|---|---|---|
| OAPI-01: Define metadata and tags | None | backend/api/main.py | Title, version, descriptions, and tags are correct |
| OAPI-02: Audit operation metadata | OAPI-01 | backend/api/routers/ | Inventory matches the generated schema |
| OAPI-03: Add schema generation command | OAPI-01 | backend/scripts/ or backend/pyproject.toml, backend/openapi/ | Artifact regenerates deterministically |
| OAPI-04: Add publication and security tests | OAPI-01, OAPI-02 | backend/tests/ | Tests verify paths, security, responses, and constraints |
| OAPI-05: Add CI stale-artifact check | OAPI-03, OAPI-04 | .github/workflows/ | CI fails when the committed schema is stale |

Each task should be implemented in an isolated worktree or with disjoint file ownership.
The coordinator integrates shared API metadata and runs the final contract checks.

## 7. Verification

Run the following checks:

~~~bash
cd backend
source .venv/bin/activate
python -m pip install --no-deps --editable .
ruff check .
mypy src api
pytest -q
cd ..
~~~

Verify:

1. /openapi.json returns valid OpenAPI 3.x JSON.
2. /docs and /redoc are available.
3. Every inventory operation exists exactly once.
4. Protected routes declare bearer security.
5. Health checks do not declare bearer security.
6. The webhook declares Stripe-Signature and does not declare bearer security.
7. Request and response constraints match the Pydantic models.
8. Regeneration produces no diff in backend/openapi/openapi.json.

## 8. Acceptance criteria

- [ ] The running API publishes a valid schema, Swagger UI, and ReDoc.
- [ ] The operation inventory is complete and accurate.
- [ ] Operation IDs are stable and unique.
- [ ] Authentication and role requirements are accurately represented.
- [ ] Error response shapes and status codes are documented.
- [ ] The checked-in artifact is generated, not hand-edited.
- [ ] Contract tests run without cloud credentials.
- [ ] CI detects stale schema artifacts.
- [ ] Postman can import the running schema or checked-in JSON.

## 9. Risks and decisions

- Renaming an operation ID is a generated-client compatibility change and requires review.
- A checked-in schema can become stale if route changes bypass the generation command.
- OpenAPI documentation must not expose SAS URLs, credentials, tenant secrets, or internal workflow details.
- A local development identity fallback does not make protected production operations public.

## 10. Handoff

The next agent should start with OAPI-01 and OAPI-02.
After the route metadata is correct, continue with OAPI-03 through OAPI-05.
The coordinator should accept a task only when its completion evidence is attached to the task handoff.
