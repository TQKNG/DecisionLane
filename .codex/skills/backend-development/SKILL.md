---
name: backend-development
description: Implement and verify PennyWorth backend tasks across FastAPI, Durable Functions, domain contracts, and Azure services.
---

# Backend development

Use this skill for backend tasks under backend/ and infrastructure changes required by those tasks.

## Implementation rules

- Keep domain rules deterministic and independently testable.
- Keep Azure, network, storage, payment, and email calls behind service classes.
- Keep Durable orchestrators deterministic.
- Put external calls in activities.
- Make retries, timeouts, idempotency, and failure states explicit.
- Preserve live authentication and authorization boundaries.
- Do not expose secrets, document contents, or signed URLs in telemetry.
- Do not hand-edit infra/main.json or backend/openapi/openapi.json.

## Verification

Run focused tests first, then the full backend checks:

~~~bash
cd backend
source .venv/bin/activate
python -m pip install --no-deps --editable .
ruff check .
mypy src api
pytest -q
cd ..
~~~

For infrastructure changes, also run:

~~~bash
az bicep build --file infra/main.bicep
~~~

For OpenAPI changes, also run:

~~~bash
cd backend
.venv/bin/python -m scripts.export_openapi
.venv/bin/python -m scripts.export_openapi --check
cd ..
~~~

After code changes, run graphify update . from the repository root.
