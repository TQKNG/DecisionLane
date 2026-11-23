# Contributing to DecisionLane

Thanks for helping improve DecisionLane.
Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Before you start

- Check existing issues and pull requests for related work.
- Open an issue to discuss a substantial change before implementing it.
Use the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) template when applicable.
- For a small fix, submit a focused pull request with the problem and solution described.
- Never include credentials, customer data, signed URLs, or production secrets in code, tests, logs, or documentation.
Use synthetic data for examples and fixtures.

## Set up the project

Follow the [README](README.md) for local backend and frontend setup.
The detailed architecture and deployment steps are in [GUIDE.md](GUIDE.md).
Copy example configuration files into local files and supply your own development values.
Do not commit local configuration or secret files.

## Make a change

1. Create a branch from `master`.
2. Keep the change scoped and add tests for behavior that can regress.
3. Follow the conventions in [AGENTS.md](AGENTS.md) and any nested instructions for files you edit.
4. Update relevant documentation when behavior, configuration, or workflow changes.
5. Do not hand-edit generated artifacts such as `backend/openapi/openapi.json` or `infra/main.json`; use their generators.

Keep deterministic business rules testable without Azure or network access.
Keep network, database, Blob, payment, and email calls out of Durable orchestrators.

## Run checks

From `backend/`:

```bash
ruff check .
mypy src api
python -m scripts.export_openapi --check
pytest --cov=refundflow --cov-report=term-missing --cov-fail-under=80
```

From `frontend/`:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

From the repository root, run `PYTHONPATH=backend/src python evals/run_local_gates.py` for changes affecting assessment behavior.
For infrastructure changes, run `bicep build infra/main.bicep`.

## Submit a pull request

Explain the problem, the approach, and any tradeoffs.
List the checks you ran and note any that could not run, including the reason.
Include screenshots for visible UI changes and describe any configuration or migration steps reviewers need.
Keep unrelated edits out of the pull request and respond to review feedback constructively.

Use `type(scope): summary` for commit messages when practical, such as `fix(api): reject invalid evidence` or `docs: clarify deployment setup`.
Release notes and version bumps are generated from commit messages on `master`, so keep commits and squash-merge pull request titles in Conventional Commits form.
See [RELEASING.md](RELEASING.md) for how releases are prepared and published.
Do not add an agent name as a commit co-author.
