# PennyWorth Frontend Coordination

This directory is the manual coordination record for the approved RefundFlow frontend work.
It does not schedule agents, create worktrees, or authorize implementation.
The coordinator maintains `TASKS.md` and resolves shared-interface questions.

Read the documents in this order.

1. `PLAN.md` defines the approved product scope.
2. `DESIGN.md` defines the reusable visual and interaction direction.
3. `CONTRACTS.md` defines cross-feature boundaries and live or demo behavior.
4. `TASKS.md` records ownership, state, and handoff evidence.

The working sequence is foundation, customer, reviewer, operations, independent review, integration, and final checks.
Parallel writers must use a common committed baseline because uncommitted changes do not transfer to a worktree.
An agent session does not create worktree isolation automatically, so the coordinator must verify each worker checkout.
When a shared checkout is unavoidable, workers receive disjoint file ownership and shared-file changes are serialized through the coordinator.
Workers do not spawn nested agents.
The approved frontend plan remains not started until the user explicitly requests implementation.

## Invocation

The coordinator selects `frontend-builder` for assigned implementation work and `frontend-reviewer` for independent review when the host exposes named role selection.
The task prompt must identify the task ID, common committed baseline, exact owned paths, dependencies, acceptance criteria, and expected evidence.
When the host spawn interface has no role selector, the coordinator includes the instruction to read `.codex/agents/frontend-builder.toml` or `.codex/agents/frontend-reviewer.toml` before work begins.
The role configuration and instructions guide behavior but do not enforce security, permissions, file isolation, or task scheduling.

Start a new trusted Codex session in the repository to load the project configuration and named roles.
The project allows up to three concurrent worker threads and limits nested delegation to one level where supported by the host.
Close completed workers before starting the independent reviewer.
Existing sessions may require restarting to discover the new roles.

After the user requests frontend implementation, use this coordinator prompt.

```text
Follow docs/frontend/PLAN.md and the coordination rules in AGENTS.md.
Read docs/frontend/DESIGN.md and docs/frontend/CONTRACTS.md.
Establish the shared foundation and record its baseline before parallel feature work.
Assign customer, reviewer-workspace, and operations tasks to frontend-builder agents with explicit file ownership.
Keep shared infrastructure under coordinator ownership and update docs/frontend/TASKS.md.
Arrange independent frontend-reviewer assessment, resolve findings, and verify the integrated workflows.
```
