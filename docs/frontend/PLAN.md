# Approved RefundFlow Frontend Plan

## Outcome

Build the complete frontend in the existing PennyWorth application without changing backend APIs, database schema, payment operations, or deployment architecture.
Use shadcn/ui with Tailwind CSS, Redux Toolkit with RTK Query, MSAL, and the current Next.js static export.
Use Chrome Lab light as the shared visual system.

## Product scope

Customer flows include sign-in, claims dashboard, three-step claim submission, evidence uploads, confirmation, claim tracking, information requests, and refund outcomes.
The review-and-submit screen provides section-specific edit actions that return to the summary after the change.
Evidence upload supports issue-specific guidance, per-file validation, previews, removal, progress, retry, and draft recovery.
Reviewer flows include a searchable queue, claim assessment, evidence and policy inspection, approval history, two-reviewer approval, and decision confirmation.
Operations flows include metrics, processing exceptions, failed refunds, and filtered claim views.
Shared patterns include navigation, page headers, forms, tables, status badges, dialogs, notifications, and loading, empty, error, disabled, and success states.

## Architecture boundaries

Use RTK Query for server records, requests, polling, and invalidation.
Use Redux slices only for shared client state such as drafts, and keep screen-local interaction state in React.
Keep evidence files in IndexedDB and retain only serializable metadata in application state.
Scope persisted data and query caches to the authenticated account.
Use a defined live data adapter and a separate demo data adapter behind stable frontend interfaces.
Demo mode uses synthetic data, resettable scenarios, customer, reviewer, and administrator role switching, and simulated mutations.
Demo mode may display future evidence or policy inspection states without assuming that a live preview API exists.
Live request failures remain visible live failures.
Live mode treats backend outcomes as authoritative for approvals, refunds, history, limits, and payment state.

## Delivery sequence

The coordinator establishes the shared foundation before feature work.
The customer, reviewer, and operations workers then implement disjoint feature areas in parallel.
An independent reviewer assesses the integrated experience before the coordinator runs final lint, TypeScript, tests, static-export build, responsive inspection, and Graphify update.

## Exclusions

This plan does not include backend implementation, database migrations, payment changes, appeals, bulk approvals, reviewer assignment, configurable policies, or publication.
