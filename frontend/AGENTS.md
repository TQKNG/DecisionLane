# Frontend agent instructions

These instructions apply to work under `frontend/`.
Read the repository-root `AGENTS.md` first.
The root instructions remain authoritative when rules overlap.

## Purpose

DecisionLane is a decision support application whose current backend implements refund claims.
The frontend is currently a clean foundation for Microsoft Entra ID authentication and future feature work.
Do not recreate the removed claim, reviewer, operations, or demo workflows unless the task explicitly requests them.

## Frontend baseline

- Next.js App Router with static export enabled.
- React and TypeScript with strict checking.
- Microsoft Entra ID authentication through MSAL.
- Redux Toolkit and RTK Query reserved for application and server state.
- pnpm is the package manager.
- shadcn/ui-style components with Tailwind CSS v4, PostCSS, and CSS design tokens.

Keep the existing stack unless the task requires a deliberate architectural change.
Do not add a UI library, state library, form library, or API client without explaining the need and updating the project documentation.

## Source organization

Use the following boundaries:

```text
src/app/           Next.js routes, layouts, and route-level composition
src/components/    Reusable UI components with no feature ownership
src/features/      Feature-owned components, hooks, API endpoints, and types
src/lib/auth/      Entra ID and MSAL integration
src/lib/api/       API client and RTK Query endpoints
src/lib/store/     Redux store and slices
src/styles/        Shared tokens and styling when this directory is introduced
tests/             Unit and browser tests
```

The current repository may not contain every directory in this map.
Create a directory only when the corresponding feature needs it.

Keep page files thin.
Put reusable behavior in components, hooks, feature modules, or library modules.
Do not place backend business rules inside React components.

## Authentication and authorization

- Preserve the existing MSAL initialization and redirect flow.
- Keep Entra configuration in environment variables prefixed with `NEXT_PUBLIC_`.
- Never commit client secrets, access tokens, refresh tokens, signed URLs, or customer data.
- Treat authentication and authorization as separate concerns.
- Do not infer permissions from display names or client-only labels.
- Use token claims and backend authorization for protected actions.
- Keep sign-in, loading, initialization-error, and sign-out states explicit.
- Do not silently fall back to synthetic data when a live request fails.

The browser may know whether a user is signed in, but the backend remains authoritative for authorization.

## State and data access

- Use local React state for short-lived view state.
- Use Redux for cross-route client state that genuinely needs global ownership.
- Use RTK Query for server state, caching, polling, and mutations.
- Do not duplicate the same server record in multiple unrelated slices.
- Keep API response types close to the API boundary.
- Prefer generated or contract-verified types when the OpenAPI workflow supports them.
- Keep request, loading, success, empty, error, and unauthorized states visible in the UI.

## UI and accessibility

- Use shadcn/ui components and variants for common controls.
- Reuse existing design tokens and shared components before creating new variants.
- Add new shadcn components under `src/components/ui` using the configured aliases.
- Use `cn()` from `src/lib/utils.ts` for class composition.
- Use the shared theme provider and support `light`, `dark`, and `system` themes.
- Validate components in both light and dark themes before handoff.
- Use semantic HTML and accessible names for controls.
- Support keyboard navigation and visible focus states.
- Maintain readable contrast and responsive behavior.
- Do not use color as the only indicator of status.
- Include useful empty, loading, error, and recovery states.
- Preserve the distinction between user-facing status and internal implementation details.
- Test important flows at narrow and wide viewport sizes.

When a backend workflow exposes multiple states, show the current state, what happened, the next action, and the responsible actor.

## Implementation workflow

Before editing:

1. Inspect `git status` and preserve unrelated changes.
2. Read the relevant route, component, store, API contract, and tests.
3. Identify whether the task is a route, feature, shared component, state, or API-boundary change.
4. Write or confirm acceptance criteria and affected UI states.

While editing:

1. Implement the smallest complete vertical slice.
2. Reuse existing components and tokens.
3. Keep feature-specific code inside its feature boundary.
4. Add tests for behavior and error paths.
5. Avoid drive-by refactors and dependency churn.

Before handoff:

1. Run the applicable verification commands.
2. Inspect the changed UI in a browser when the change affects layout or interaction.
3. Review the diff for unrelated edits, secrets, stale imports, and dead files.
4. Report changed files, verification results, and any remaining limitation.

## Verification

Run from `frontend/`:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` runs Vitest in Node against `tests/**/*.test.ts`.
Data-boundary tests build a store with `makeStore` and inject a scripted `fetchFn` and token provider, so they need no Azure or network access.
Add data-boundary tests for every new RTK Query endpoint.
Do not report tests as passing when the command was not actually executed successfully.

When a browser test suite is introduced, add its command to `package.json`, this file, and CI in the same change.

## Files and generated output

Do not hand-edit generated output such as:

- `.next/`
- `out/`
- generated OpenAPI artifacts
- lockfile entries unrelated to the dependency change

Use the project generator or package manager when generated files must change.
Do not remove existing files unless they are part of the requested change.

## Handoff format

End implementation work with:

```text
Summary:
- <completed behavior>

Changed:
- <file>: <purpose>

Verification:
- <command>: <result>

Remaining:
- <known limitation or none>
```

Keep this file concise and update it when the frontend architecture or verification commands change.
