## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Multi-agent workflow

Use the project-scoped roles in `.codex/config.toml` for bounded frontend tasks.
The coordinator owns the approved plan, dependency and shared-configuration changes, shared components, integration, and the task ledger at `docs/frontend/TASKS.md`.
Do not start frontend implementation until the user explicitly requests it.
Treat `docs/frontend/` as a manual coordination convention rather than an automatic scheduler.
Use a common committed baseline for parallel work because uncommitted changes do not transfer to worktrees.
Confirm each worker's checkout because agent sessions do not automatically create isolated worktrees.
Use separate worktrees for concurrent writers when available.
If workers must share one checkout, assign disjoint file ownership and serialize changes to shared files.
Only the coordinator updates `docs/frontend/TASKS.md` and shared files assigned to the coordinator.
Worker agents must not spawn nested agents.
Each handoff must state the baseline, owned files, changes, checks, evidence, integration needs, and unresolved issues.
Run integrated checks only after the coordinator has combined the accepted work.
