<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend collaboration

Read `docs/frontend/README.md`, `docs/frontend/PLAN.md`, `docs/frontend/DESIGN.md`, and `docs/frontend/CONTRACTS.md`, with every path resolved from the repository root, before accepting a frontend implementation task.
The coordinator owns dependencies, global styling, shadcn configuration, Redux store configuration, RTK Query transport, authentication integration, shared components, and `docs/frontend/TASKS.md`.
Feature workers own only the files listed in their task assignment.
Do not edit shared infrastructure unless the coordinator explicitly transfers ownership.
Build the planned frontend with shadcn/ui, Tailwind CSS, Redux Toolkit with RTK Query, and MSAL while preserving static export.
Keep live and demo behavior separate, and never replace a failed live request with demo data.
Independent review assignments are read-only unless the coordinator explicitly assigns a review fix.
Feature workers and independent reviewers must not spawn nested agents.
Run the task-specific checks and report the result with any limitations.
