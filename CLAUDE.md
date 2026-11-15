# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` (root) and `frontend/AGENTS.md` hold the authoritative repo rules (naming, generated files, Graphify, handoff format). Read them before editing. Highlights that are easy to miss:

- Never use the em dash character.
- Do not begin frontend work unless the user explicitly asks for it. The frontend is a clean Entra ID/MSAL foundation; do not recreate the removed claim, reviewer, or operations flows.
- Never hand-edit generated files: `infra/main.json` (from `infra/main.bicep`), `backend/openapi/openapi.json` (run `python -m scripts.export_openapi` from `backend/`), `backend/build/`, `*.egg-info`, `frontend/.next/`, `frontend/out/`, `graphify-out/`. Do not edit `CHANGELOG.md` files manually.
- When `graphify-out/graph.json` exists, run `graphify query "<question>"` before answering codebase questions, and run `graphify update .` from the repo root after modifying code.
- Use synthetic fixtures only. No credentials, signed URLs, or customer data anywhere.

## What this is

DecisionLane is a decision support app; the current backend implements refund claims. The Python package, Azure resources, and Docker image still use the name `refundflow`. A model only recommends; a human reviewer decides before any refund is executed.

## Commands

Backend (Python 3.11 only, run from `backend/`; CI uses `pip install --pre -e '.[dev]'`):

```bash
ruff check .
mypy src api
python -m scripts.export_openapi --check        # fails if openapi.json is stale; drop --check to regenerate
pytest --cov=refundflow --cov-report=term-missing --cov-fail-under=80
pytest tests/unit/test_claim_api.py::test_name  # single test
uvicorn api.main:app --reload --port 8000       # API, docs at /docs
func start --port 7071                          # Durable Functions host (needs local.settings.json)
```

Local eval gates (from repo root, also run in CI): `PYTHONPATH=backend/src python evals/run_local_gates.py`

Frontend (Node 22, pnpm 11.21.0, from `frontend/`): `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm dev`. `pnpm test` is a placeholder echo, so never report it as passing tests.

Infra: `az bicep build --file infra/main.bicep` (CI check). Deploys are manual GitHub workflows against the `dev` environment (infra first, then app).

## Architecture

Two entry points share the domain code in `backend/src/refundflow/`:

- **HTTP API** (`backend/api/`): FastAPI app in `main.py` mounting routers `claims`, `orders`, `uploads`, `reviews`, `webhooks`. Auth is in `auth.py` (Entra token validation), DI in `dependencies.py`. Served from the container built by `backend/Dockerfile`.
- **Durable Functions** (`backend/function_app.py`): HTTP starters (`start_refund_workflow`, `signal_approval`), `refund_orchestrator`, and activities (`validate_evidence_bundle`, `check_malware_status`, `process_document`, `assess_claim`, `record_approval`, `execute_refund`, `send_status_email`, and others). The orchestrator waits for a reviewer approval signal before `execute_refund`. Activity wiring to services lives in `backend/functions/services.py`.

Layering inside `refundflow/`: `domain/` (pure models and rules: evidence validation, safety policy), `services/` (adapters for Blob, Content Safety, Content Understanding, Document Intelligence, AI Search policy retrieval, embeddings, malware scan, Stripe payments, email), `repositories/` (Cosmos DB for claims and orders), `workflows/assessment.py` (Foundry agent assessment), plus `config.py` (pydantic-settings) and telemetry.

Rules that constrain changes:

- Orchestrators must be deterministic: network, database, Blob, payment, and email calls belong in activities only.
- Business rules in `domain/` must be testable without Azure or network access. Unit tests in `backend/tests/unit` use fakes; `tests/integration` is empty.
- Any API route or schema change requires regenerating `backend/openapi/openapi.json`, or CI fails.
- Mypy is strict about untyped defs (`disallow_untyped_defs`); ruff line length is 100.

Other top-level directories: `infra/` (Bicep, source of truth), `evals/` (local gates plus Foundry evaluation), `policies/` and `processes/` (refund policy and process documents indexed by `scripts/index_policies.py`), `scripts/` (order seeding, dataset building), `GUIDE.md` (sequential build and deployment guide).

Frontend: Next.js App Router with static export, MSAL for Entra ID, Redux Toolkit and RTK Query reserved for state, shadcn/ui-style components with Tailwind v4. Entra config comes from `NEXT_PUBLIC_*` env vars (see `frontend/README.md`). Do not add UI, state, form, or API-client libraries without justification.
