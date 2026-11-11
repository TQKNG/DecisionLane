# Customer Claim Creation Process

## Status tags

- [ready] Implemented in the current repository.
- [need implement] Required for the intended end-to-end flow, but not implemented or not enforced today.
- [suggestions] Recommended design or product behavior; confirm against business requirements before implementation.

This process describes the customer refund-claim journey and the backend components that own each step.
It is based on the current API and worker implementation, with planned evidence classification aligned to `spec/specs-002.md`.
The leave and maternity-leave cards are separate product flows and are not covered here.

## 1. Customer journey

### 1.1 Sign in and view claims

1. [suggestions] The customer signs in with Microsoft Entra ID and chooses Claim Processing from the portal.
2. [ready] The portal requests `GET /v1/claims`; the API requires the Customer role and returns only claims whose `customer_id` matches the authenticated user's ID.
3. [ready] The claims table is read from the Cosmos DB `claims` container through `ClaimRepository.list_claims`.
4. [suggestions] Display claim type, order, created date, and a human-readable label for the current claim status. Do not treat a client-supplied customer ID as an authorization input.

### 1.2 Create a claim

1. [suggestions] The customer chooses Create Claim and enters the order, claim type, reason, requested amount, and currency.
2. [ready] The portal sends `POST /v1/claims` with `order_id`, `claim_type`, `reason`, `requested_amount`, and `currency`.
3. [ready] The endpoint requires the Customer role. It derives `customer_id` and `customer_email` from the authenticated user, then asks `OrderRepository.get_order` for an order owned by that customer.
4. [ready] The API rejects an unknown or unowned order with 404, and rejects a currency mismatch or a requested amount above the paid amount with 400.
5. [ready] The API creates a `RefundClaim` with a generated ID and `draft` status, then persists it through `ClaimRepository.create_claim` in Cosmos DB. A successful response is 201 and contains the claim.
6. [suggestions] If business rules disallow duplicate active claims for the same order and claim type, return a clear conflict response and enforce it in the backend, not only in the portal.

The current `ClaimType` values are `damaged_item`, `delayed_delivery`, `non_delivery`, and `wrong_item`.
The reason must contain 10 to 2,000 characters, and the requested amount must be greater than zero.

### 1.3 Add and upload evidence

1. [need implement] Before upload, show the evidence requirements for the selected claim type and collect a role or evidence category for each file, or classify the files after upload. The current upload API records file metadata but does not accept or enforce an evidence role.
2. [ready] For each file, the portal calls `POST /v1/claims/{claim_id}/uploads` with `file_name`, `content_type`, and `size_bytes`.
3. [ready] The API verifies claim ownership, enforces a maximum of five files, and asks `BlobStorageService` for a short-lived direct-upload grant to the quarantine container.
4. [ready] The API stores a `ClaimDocument` as a `document` aggregate item in Cosmos DB and changes the claim status to `uploading`. The initial document status is `uploaded`; at this point the file bytes may not have reached Blob Storage yet.
5. [ready] The portal uploads the bytes directly to the returned Blob URL using the required headers. File bytes do not pass through the FastAPI process.
6. [ready] After the upload, the portal calls `POST /v1/claims/{claim_id}/uploads/{document_id}/complete`. The API reads Blob properties and compares the actual size and content type with the values recorded at upload request time.
7. [need implement] On completion, verify the Blob belongs to this claim and document, then compare actual size and content type with the request and inspect the file signature. Persist an idempotent upload-complete state only after validation. The current endpoint checks Blob properties but does not update the document or verify its content.
8. [need implement] Validate that the selected claim type has its complete required evidence bundle before submission. The current API only requires at least one document.
9. [suggestions] Keep the upload grant short-lived and scoped to one generated Blob name with create/write permissions, as it is today. Never log or persist the grant URL; treat it as a bearer credential.

#### Current upload limits

- [ready] `BlobStorageService` permits PDF, JPEG, PNG, and WebP content types, with a 4 MiB maximum file size and a maximum of five files per claim.
- [ready] PDF processing allows one or two pages; image bytes are checked by the extraction service.
- [need implement] The draft's 5 MB limit and PDF/PNG/JPEG-only list do not match the backend. Either update the product requirements to the current limits or change the backend and tests to the intended limits before release.
- [suggestions] Treat browser-side checks as usability feedback only. Keep authoritative size, content, and file-format checks on the server after upload.

#### Intended minimum evidence by claim type

These requirements come from `spec/specs-002.md`. They are intended rules, not enforced by the current upload or submit endpoints.

| Claim type | Intended minimum evidence |
|---|---|
| `damaged_item` | A receipt or invoice, plus a damage photo classified as showing visible damage |
| `wrong_item` | Purchase evidence (receipt, invoice, or order confirmation), plus a product photo or package label |
| `non_delivery` | An order confirmation, plus tracking evidence |
| `delayed_delivery` | An order confirmation or receipt, plus tracking evidence |

1. [need implement] Add deterministic evidence-bundle validation after document classification and before the claim enters human review.
2. [need implement] Route missing, unreadable, unrelated, or insufficient-confidence evidence to `needs_information` or a review path with a customer-readable reason. Do not automatically reject a claim solely because a classifier has low confidence.

### 1.4 Submit the claim

1. [ready] When the customer selects Submit, the portal calls `POST /v1/claims/{claim_id}/submit`.
2. [ready] The API verifies claim ownership, allows only `draft` or `uploading` claims, and requires at least one document aggregate item.
3. [ready] The API calls the Durable Functions HTTP starter at `/refund-workflows` with the claim ID and document IDs. The starter creates a `refund_orchestrator` instance and returns its instance ID.
4. [ready] The API stores the workflow instance ID on the claim, changes its status to `scanning`, and returns 202 Accepted.
5. [need implement] Make submission idempotent and protect against duplicate workflow starts on retries. Validate all required documents and their completed-upload states before starting the workflow.
6. [suggestions] Close the modal only after the API returns success, then refresh the claim list or detail view using the returned claim ID. If submission fails, keep the form state and show a recoverable error.

The function starter validates that `claim_id` and `document_ids` are present, but does not independently authorize the customer or validate document ownership. Keep it as an internal service boundary called by the authenticated API, or add equivalent authorization and claim/document checks before exposing it directly.

#### Reliable workflow start

- [need implement] Persist a submission record and an outbox event in the same Cosmos partition as the claim before dispatching work. Include the claim ID, a client idempotency key, the validated document IDs, and a submission version.
- [need implement] Have a dispatcher start Durable Functions using a deterministic instance ID for that claim submission. Retrying the outbox event must return or reconcile the same workflow, not create another one.
- [need implement] Persist the workflow instance ID and dispatch outcome. Provide a reconciliation path for a timed-out HTTP call where the workflow may have started but the API did not receive its response.
- [suggestions] Return the same accepted response for a repeated idempotency key and reject reuse of that key with a different request body.

## 2. Backend processing flow

### 2.1 Malware scan

1. [ready] Azure Defender for Storage scans files written to the quarantine container and exposes the scan result in Blob tags.
2. [ready] The Durable orchestrator calls the `check_malware_status` activity for each document. The activity loads the claim and document from Cosmos DB and asks `MalwareScanService` to read the Blob scan-result tag.
3. [ready] While a scan is pending, the orchestrator waits 30 seconds and checks again, up to a 30-minute deadline. Durable timers are used for these waits; the orchestrator itself does not call Blob Storage or external services.
4. [ready] A malicious result invokes `reject_document`, which writes document status `malware_rejected` and claim status `rejected`.
5. [ready] Current behavior also treats a scanner error as a malware rejection, and changes the claim to `needs_information` when polling times out.
6. [need implement] Keep processing fail-closed when the scanner is unavailable, but distinguish that operational failure from a malware detection. Retry transient scan errors, alert operations when retries or the deadline are exhausted, and use an explicit retriable hold/failure state rather than telling the customer their evidence was malicious or that they must provide more information.
7. [need implement] Record explicit per-document malware states, including clean completion. Today clean results are not persisted to the document.
8. [need implement] Add a customer-visible notification for malware rejection or an operational hold. There is no Event Grid-triggered application workflow or push notification in this path; the orchestrator starts when the submit API calls the HTTP starter and polls Defender's Blob tags.

### 2.2 Content Safety and document extraction

1. [ready] Once all files pass malware checks, the orchestrator sets the claim status to `processing`.
2. [ready] For each document, the `process_document` activity downloads bytes from quarantine through `EvidenceStorageService`, then calls `ContentSafetyService.analyze`.
3. [ready] Content Safety blocks set document status `safety_blocked` and claim status `rejected`. A `review` decision is retained as a safety-review requirement rather than being treated as a clean pass.
4. [ready] Non-blocked documents are sent to `DocumentExtractionService`, which validates the file, calls Azure Document Intelligence `prebuilt-layout`, and returns extracted text and key-value pairs.
5. [ready] Extraction results are stored as `extraction:{document_id}` aggregate items in Cosmos DB. Documents with a `pass` safety decision are copied from quarantine to the evidence container and removed from quarantine; documents requiring safety review are not promoted.
6. [need implement] Validate actual file bytes and format before sending them to Content Safety or Document Intelligence. The extraction service performs file checks today, but only after the Content Safety call.
7. [need implement] Add Content Understanding classification between Content Safety and Document Intelligence, as specified in `spec/specs-002.md`. Persist the classification with the document and use the claim type to validate the evidence bundle.
8. [need implement] Persist truthful document-stage updates such as malware scanning, safety scanning, extracting, and extraction complete. The model defines some of these statuses, but the workflow currently does not set most of them.
9. [suggestions] Treat evidence text and model outputs as untrusted data. Keep deterministic claim rules and refund authorization outside the classifier; model output must not approve or pay a refund.
10. [suggestions] Retry transient AI or storage failures with bounded backoff and alert operations after exhaustion. Do not convert an infrastructure outage into a negative customer eligibility decision.

### 2.3 Assessment and human approval

1. [ready] After document processing, the orchestrator calls `assess_claim` with the extracted documents and whether any safety review is required.
2. [ready] `run_assessment_workflow` validates that evidence exists, retrieves relevant refund policy passages, asks the assessment agent for a structured result, and checks grounding and decision constraints.
3. [ready] The assessment is persisted as an `assessment` aggregate item. If safety review is required, the result is marked ineligible and its summary explains the review requirement.
4. [ready] The orchestrator changes the claim status to `pending_approval` and waits for one reviewer decision, or two distinct reviewer decisions when the assessment requires two reviewers.
5. [ready] A reviewer loads the assessment from `GET /v1/reviews/{claim_id}` and posts `approve` or `reject` to `POST /v1/reviews/{claim_id}/decision`. The API checks reviewer role, claim state, workflow ID, and duplicate reviewer decisions, then signals the Durable workflow.
6. [need implement] Include document metadata and classification in the reviewer response, and provide evidence through an authenticated, claim-authorized endpoint. The current `ReviewDetail` returns the claim, assessment, and approval records, but not the evidence documents or classifications.
7. [need implement] Add a distinct, reviewable state and reviewer action for content-safety `review` outcomes. The current flow continues to `pending_approval` with an ineligible assessment but does not expose a dedicated customer or reviewer status for the safety hold.
8. [ready] A reviewer rejection changes the claim to `rejected` and sends a status email. Approval changes the claim to `approved`; only then does the workflow continue to refund execution.
9. [suggestions] Keep human approval mandatory for every refund. Classifier confidence, evidence classification, and AI assessment are supporting evidence, not an authorization to issue payment.
10. [suggestions] Record reviewer identity, decision, rationale, and timestamp as an append-only audit event. Avoid placing extracted document text or sensitive evidence in routine application logs.

### 2.4 Refund and customer status

1. [ready] After required approvals, the `execute_refund` activity loads the claim and order, calls Stripe, and stores the refund result. The activity runs with Durable retry configuration.
2. [need implement] Use a stable Stripe idempotency key derived from the claim/refund operation and persist the Stripe refund ID before retrying or reconciling. Durable activity retries must not create duplicate refunds if Stripe succeeded but the activity lost its response.
3. [ready] The workflow changes the claim to `refund_submitted` and sends a status email.
4. [ready] Stripe sends refund events to `POST /v1/webhooks/stripe`. The API verifies the Stripe signature, updates the claim to `refunded` or `refund_failed`, and sends a status email.
5. [ready] The customer can fetch current claim status through `GET /v1/claims` or `GET /v1/claims/{claim_id}`.
6. [need implement] The original draft describes push notifications, but the repository currently has no push or real-time status channel. The email service is used for reviewer rejection, refund submission, and Stripe refund completion/failure; it is not called for every status transition.
7. [suggestions] Start with client polling of the claim list/detail with a reasonable interval and stop polling at terminal states. Add server-sent events or another push mechanism only if the product needs real-time updates.
8. [need implement] Make status-change notifications reliable with an outbox or equivalent durable event record. A failed email or notification must not roll back the claim transition, and retries must not send duplicate messages.

## 3. Status model

Claim status and document processing status are separate. A single claim can have multiple documents at different processing stages.

| Entity | Current backend statuses | Meaning in the customer journey |
|---|---|---|
| Claim | `draft`, `uploading`, `scanning`, `processing`, `needs_information`, `pending_approval`, `approved`, `rejected`, `refund_submitted`, `refunded`, `refund_failed`, `pending_ai_capacity`, `closed` | Overall claim lifecycle. `pending_ai_capacity` is defined in the model but is not used in the described workflow. |
| Document | `uploaded`, `malware_scanning`, `malware_rejected`, `safety_scanning`, `safety_review_required`, `safety_blocked`, `ready_for_extraction`, `extracting`, `extraction_complete`, `processing_failed` | Per-file lifecycle. Several stages are defined but not currently written by the workflow. |

The original draft used labels such as `initiate`, `document valid`, `pending approval`, and `refund issued`, along with internal stage labels such as `content_validation`, `document_extraction`, and `evidence_bundle`.
Those are not current enum values.

1. [need implement] Agree on a stable customer-facing status vocabulary and map it to backend claim/document statuses; do not make UI state the source of truth.
2. [suggestions] Use a timeline that distinguishes completed, current, needs-customer-action, and terminal states. Do not show a step as complete just because a request was accepted or a file upload was requested.

### 3.1 Allowed claim transitions

The following is the recommended transition contract. It is not fully enforced by the current repository.

| Transition | Owner / guard |
|---|---|
| `draft` -> `uploading` | Upload API after creating a document record |
| `draft` or `uploading` -> `scanning` | Submit API only after all uploads are verified and the evidence bundle is valid |
| `scanning` -> `processing` | Durable workflow after every document has a clean malware result |
| `scanning` -> `rejected` | Durable activity only for a confirmed malware detection |
| `scanning` -> operational hold | Durable workflow after scan failure or timeout; retry and operations action are required. This is not a current `ClaimStatus` value. |
| `processing` -> `rejected` | Durable activity after a Content Safety block |
| `processing` -> `needs_information` | Deterministic evidence validation finds missing or insufficient evidence |
| `processing` -> `pending_approval` | Assessment and all required evidence processing are complete |
| `needs_information` -> `uploading` | Customer adds requested evidence, if claim-revision rules permit resubmission |
| `pending_approval` -> `rejected` | Authorized reviewer rejection |
| `pending_approval` -> `approved` | Required distinct reviewer approvals are recorded |
| `approved` -> `refund_submitted` | Refund operation has been safely accepted by Stripe |
| `refund_submitted` -> `refunded` or `refund_failed` | Verified Stripe webhook or reconciliation result |
| eligible non-terminal state -> `closed` | Explicit business closure or expiry policy, with an audit reason |

1. [need implement] Enforce transitions with a shared state-transition policy and conditional Cosmos writes, so stale API requests or duplicate activities cannot move a claim backward or overwrite a terminal result.
2. [need implement] Store transition time, actor/component, correlation ID, and reason in an append-only status history. Keep the current status on the claim for efficient reads.
3. [need implement] Represent operational holds separately from customer-action states. Do not use `needs_information` for scanner or infrastructure outages unless the customer actually needs to provide something.
4. [suggestions] Define recovery transitions explicitly, including who can retry a failed processing stage and which prior artifacts can be reused safely.

## 4. Important implementation gaps

- [need implement] Enforce claim-type evidence requirements and upload completion before submission.
- [need implement] Add Content Understanding classification and deterministic evidence-bundle validation from `spec/specs-002.md`; its related tasks are not yet checked off in `tasks/specs-002/tasks.md`.
- [need implement] Persist document processing transitions and return evidence details needed by customers and reviewers.
- [need implement] Add idempotency and recovery handling around upload completion, workflow start, and retries so transient network failures do not create duplicate claims or workflows.
- [need implement] Add customer notifications for all important status changes, or explicitly define polling as the initial UX.
- [need implement] Add bounded retries, operational alerts, and a reconciliation job for stuck submissions, workflows, malware checks, refunds, and notifications.
- [suggestions] Define retention separately for quarantine and clean evidence, including cleanup of abandoned uploads and legal holds. Do not delete evidence until business retention and legal requirements are agreed.
- [suggestions] Emit structured audit and operational events with claim/document/workflow IDs, stage, outcome, duration, and correlation ID. Do not log upload grant URLs, credentials, full document content, or unnecessary personal data.
- [suggestions] Keep claim-status changes in the API/repository or Durable activities, and keep external I/O in activities/services rather than Durable orchestrator code.
