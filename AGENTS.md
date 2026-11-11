# PennyWorth agent instructions

These instructions apply to Codex agents working in this repository.
More specific instructions in nested AGENTS.md files take precedence for files below their directory.
User instructions take precedence over this file.

## Repository map

PennyWorth is the RefundFlow refund-claim application.
The backend is Python 3.11 with FastAPI, Azure Durable Functions, Cosmos DB, Blob Storage, Azure AI services, Microsoft Foundry, and Stripe.
The frontend is Next.js with static-export compatibility, MSAL, Redux Toolkit, and RTK Query.

- backend/api: FastAPI application, authentication, and HTTP routers.
- backend/function_app.py: Durable Functions starters, orchestrator, and activities.
- backend/src/refundflow: domain contracts, services, repositories, policies, and workflows.
- backend/tests: backend unit and API tests.
- frontend/src: customer, reviewer, and operations experiences.
- frontend/tests: frontend data-boundary tests.
- infra/main.bicep: infrastructure source of truth.
- backend/openapi/openapi.json: generated OpenAPI artifact.
- spec/: implementation specifications.
- tasks/: Spec Kit-style executable task breakdowns.
- GUIDE.md: broad sequential build and deployment guide.
- graphify-out/: generated knowledge graph and navigation artifacts.

## Always-on rules

- Never use the em dash character.
- Preserve unrelated dirty changes.
- Inspect git status before editing.
- Never use destructive git commands or broad deletion commands without explicit authorization.
- Use apply_patch for local file edits.
- Do not manually edit CHANGELOG.md files or generated files.
- Do not add credentials, signed URLs, customer data, or production secrets to source, tests, schemas, or documentation.
- Use synthetic fixtures and deterministic test data.
- Keep Python functions and variables in snake_case.
- Keep Python and TypeScript classes, types, and public members in PascalCase.
- Keep TypeScript and JavaScript locals and private methods in camelCase.
- Use ALL_CAPS with underscores for TypeScript and JavaScript global constants.
- Keep deterministic business rules testable without Azure or network access.
- Keep network, database, Blob, payment, and email calls out of Durable orchestrators.
- Do not begin frontend implementation unless the user explicitly requests frontend work.

## Generated artifacts

Never hand-edit these files or directories:

- infra/main.json: generate from infra/main.bicep.
- backend/openapi/openapi.json: generate with backend/scripts/export_openapi.py.
- backend/build/.
- backend/src/refundflow.egg-info/.
- frontend/.next/ and frontend/out/.
- graphify-out/: update with graphify.

## Graphify

When the user types /graphify, use the installed graphify skill or instructions before doing anything else.
For codebase questions, run graphify query "<question>" first when graphify-out/graph.json exists.
Use graphify path "<A>" "<B>" and graphify explain "<concept>" for focused questions.
Dirty graphify output is not a reason to skip graphify.
After modifying code, run graphify update . from the repository root.

## Spec-driven work

DO NOT IMPLEMENT below
Read the relevant spec/<spec>.md and tasks/<spec-slug>/tasks.md before implementation.
Implement only an unchecked task whose dependencies are complete.
Read the assigned task.md, relevant nested AGENTS.md files, and the current implementation of owned files before editing.
Workers must edit only their assigned files, must not spawn nested agents, and must report handoff evidence.
The coordinator owns task decomposition, shared files, dependency changes, checklist updates, integration, and final verification.
Use separate worktrees for concurrent writers when available.
Run integrated checks only after accepted worker changes are combined.

Use these repository skills for detailed workflows:

- .codex/skills/spec-driven-development/SKILL.md
- .codex/skills/backend-development/SKILL.md
- .codex/skills/openapi-contract/SKILL.md
- .codex/skills/repository-documentation/SKILL.md

Use these repository agent profiles for bounded roles:

- .codex/agents/spec-coordinator.toml
- .codex/agents/backend-builder.toml
- .codex/agents/backend-reviewer.toml
- .codex/agents/documentation-editor.toml
