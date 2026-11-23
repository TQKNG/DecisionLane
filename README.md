# DecisionLane

DecisionLane is a decision support application that brings evidence, policy, and human judgment into one workflow.
The current backend implements refund claims, including evidence checks, policy retrieval, AI assisted assessment, human review, and payment processing.
The backend contains a FastAPI API and Azure Durable Functions workflow.
The Next.js frontend is under active development, so the full customer and reviewer experience described in [GUIDE.md](GUIDE.md) is not yet available through the UI.
Some internal package and Azure resource identifiers still use `refundflow`.

## How it works

1. A customer submits a claim and uploads supporting evidence.
2. Backend services validate files, scan and classify evidence, and retrieve relevant refund policy passages.
3. An assessment workflow prepares a recommendation for a human reviewer.
4. A reviewer makes the decision before any refund is executed.

The model does not approve or issue refunds on its own.

## Repository layout

| Path | Purpose |
| --- | --- |
| `backend/api/` | FastAPI application and HTTP routes |
| `backend/function_app.py` | Durable Functions orchestration and activities |
| `backend/src/refundflow/` | Domain rules, repositories, services, and workflows |
| `backend/tests/` | Backend tests |
| `frontend/` | Next.js application |
| `infra/` | Azure infrastructure and deployment parameters |
| `evals/` | Local and Foundry evaluation assets |
| `GUIDE.md` | Detailed build and deployment guide |

## Local development

Use Python 3.11, Node.js 22, and pnpm 11.21.0.
The API can start locally without cloud credentials, but claim processing requires the Azure and Stripe services configured in `backend/.env`.
Use only local or synthetic test data when developing.

### Backend

From the repository root:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --pre -e '.[dev]'
cp .env.example .env
uvicorn api.main:app --reload --port 8000
```

The API documentation is available at `http://localhost:8000/docs`.
To run the Durable Functions host, configure `backend/local.settings.json` from `backend/local.settings.example.json`, then run `func start --port 7071` from `backend/`.
See [GUIDE.md](GUIDE.md) for the Azure resources and service configuration needed for the complete workflow.

### Frontend

In a separate terminal:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`.
For Microsoft Entra sign-in and API access, configure the `NEXT_PUBLIC_` variables described in the [frontend README](frontend/README.md).

## Verification

Run backend checks from `backend/`:

```bash
ruff check .
mypy src api
python -m scripts.export_openapi --check
pytest --cov=refundflow --cov-report=term-missing --cov-fail-under=80
```

Run frontend checks from `frontend/`:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

The [CI workflow](.github/workflows/ci.yml) also runs local evaluation gates and builds the Bicep template.

## CI and development deployment

GitHub Actions runs [CI](.github/workflows/ci.yml) on pull requests and pushes to `master`.
CI checks the backend, frontend, local evaluation gates, and Bicep template.
The frontend job includes lint, typecheck, and production build.

The [infrastructure](.github/workflows/deploy-infra-dev.yml) and [application](.github/workflows/deploy-dev.yml) deployment workflows run manually from `master` and use the GitHub `dev` environment.
Run CI successfully before deploying, deploy infrastructure first when resources change, and then run the application workflow.
The [weekly Foundry evaluation](.github/workflows/evaluate.yml) runs on a schedule or manually from `master` and requires configured development Azure resources.

Configure the `dev` environment with the Azure OIDC variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_RESOURCE_GROUP`, plus the service variables referenced by the deployment and evaluation workflows.
Store the Static Web Apps deployment token as `AZURE_STATIC_WEB_APPS_API_TOKEN` in GitHub Actions secrets.
Keep Azure and Stripe runtime secrets in Key Vault rather than repository files.
The public repository protects `master` with required pull requests, resolved review conversations, and the `frontend` and `infrastructure` CI checks.
Branch protection is managed in GitHub Settings, not by these workflow files.

## Project policies

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. The [Code of Conduct](CODE_OF_CONDUCT.md) describes participation expectations and maintainer contact details.
The release process, including how the changelog is generated, is described in [RELEASING.md](RELEASING.md).
Licensing terms are in [LICENSE](LICENSE).
