# Frontend Coordination Contracts

## Ownership contract

The coordinator owns dependencies, global styles, shadcn setup, Redux store setup, RTK Query transport, MSAL integration, shared components, task ledger updates, integration, and final verification.
The customer worker owns customer feature files assigned in `TASKS.md`.
The reviewer worker owns reviewer feature files assigned in `TASKS.md`.
The operations worker owns operations feature files assigned in `TASKS.md`.
The independent reviewer has no edit ownership unless explicitly reassigned to make a fix.

## State and data contract

RTK Query responses are not copied into Redux slices.
URL parameters own shareable queue filters, sorting, and pagination.
Draft fields may persist per account, while evidence files remain in IndexedDB with recovery errors shown to the user.
The frontend sends and renders monetary values using the backend contract without treating display values as payment authority.
Approval state and payment state remain separately represented.

## Live and demo contract

Live mode calls existing backend endpoints through the authenticated application transport.
Demo mode is explicit, locally scoped, resettable, and uses synthetic data only.
Demo mode may represent future backend capabilities such as richer history, evidence previews, information-request responses, and operations recovery.
No live failure may silently fall back to demo data.
No demo mutation may call a live endpoint.

## Handoff contract

Every worker handoff names the common committed baseline, owned files, changed files, checks run, results, screenshots or other evidence when available, integration requirements, and unresolved issues.
The coordinator records accepted work and evidence in `TASKS.md`.
The coordinator resolves shared-file changes before workers edit them.
