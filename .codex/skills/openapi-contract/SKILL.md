---
name: openapi-contract
description: Maintain the generated FastAPI OpenAPI contract and verify publication, security, and schema consistency.
---

# OpenAPI contract

Use this skill for API route metadata, OpenAPI publication, generated schema, Postman compatibility, or contract tests.

FastAPI is the source of truth.
Update routes, Pydantic models, or application metadata first.
Never hand-edit backend/openapi/openapi.json.

Verify that:

- /openapi.json, /docs, and /redoc are available.
- Operation IDs are stable and unique.
- Tags, summaries, descriptions, request models, response models, and status codes are accurate.
- Protected routes declare Entra bearer security and role requirements.
- Health checks remain public.
- The Stripe webhook uses Stripe-Signature validation rather than bearer security.
- Azure Blob SAS upload operations are not incorrectly represented as API routes.

Run:

~~~bash
cd backend
.venv/bin/python -m scripts.export_openapi
.venv/bin/python -m scripts.export_openapi --check
pytest -q tests/unit/test_openapi.py
cd ..
~~~

Review the generated diff for accidental internal endpoints, secrets, signed URLs, or customer data.
