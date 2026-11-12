# RefundFlow Business Rules

## Purpose and rule status

This draft collects business rules implied by `spec/specs-001.md`, `spec/specs-002.md`, and the customer claim and review processes.
It separates business policy from current technical behavior.
Rules marked as defined are supported by project specifications or the described workflow, but are not necessarily enforced by the current implementation.

- [defined] Explicitly stated in a project specification or existing claim process.
- [proposed] A recommended default where the source documents do not define a complete rule.
- [decision needed] Requires an explicit product or business-owner decision before implementation.
- [technical constraint] Current backend behavior or limit, not a business policy. Confirm whether it should remain.

## 1. Customer and order eligibility

| ID | Rule | Status / source |
|---|---|---|
| ELG-01 | A customer may create or view claims only as the authenticated customer represented by their Entra identity. Customer identity must come from the verified token, not request payload fields. | [defined] `spec/specs-001.md`; create-claim process |
| ELG-02 | The order must exist and belong to the authenticated customer. Do not disclose whether another customer's order exists. | [defined] Current create-claim API behavior |
| ELG-03 | The requested refund currency must match the order currency. The requested amount must be greater than zero and no greater than the amount paid. | [defined] Claim API and domain contract |
| ELG-04 | [decision needed] Decide whether customers can submit multiple claims for the same order, claim type, or purchase line, and define when a prior claim ceases to count as active. | Not decided in source documents |
| ELG-05 | [decision needed] Define eligible purchase channels, order age limits, claim filing deadlines, excluded items, and any legal or contractual exceptions. | Not decided in source documents |
| ELG-06 | [decision needed] Define whether a claim can cover the full order, selected line items, shipping/tax, or only an amount calculated by the system. | The API currently accepts a requested amount; policy is not specified |

## 2. Claim creation and customer input

| ID | Rule | Status / source |
|---|---|---|
| CLM-01 | Supported claim types are `damaged_item`, `delayed_delivery`, `non_delivery`, and `wrong_item`. | [defined] `ClaimType` domain contract |
| CLM-02 | A new claim begins in `draft` and is associated with the authenticated customer and a verified order. | [defined] Claim process and domain contract |
| CLM-03 | The customer must provide a reason of 10 to 2,000 characters. | [technical constraint] Current request model; confirm this is suitable customer policy |
| CLM-04 | [proposed] Normalize and validate user-entered order identifiers and reason text on the server. Reject empty or malformed values with a clear, non-sensitive explanation. | Recommended validation |
| CLM-05 | [decision needed] Decide whether a customer may edit claim details after creation, and identify which fields are editable before submission, during `needs_information`, and after submission. | Not decided in source documents |
| CLM-06 | [decision needed] Define whether a customer may withdraw a claim, and the states and timing in which withdrawal is permitted. | Not decided in source documents |

## 3. Evidence requirements

The minimum evidence below comes from `spec/specs-002.md`.
It is a target rule set and is not enforced by the current upload and submit endpoints.

| ID | Claim type | Required evidence | Status |
|---|---|---|---|
| EVD-01 | `damaged_item` | Receipt or invoice, plus a damage photo classified as a `damage_photo` with visible damage. | [defined] `spec/specs-002.md` |
| EVD-02 | `wrong_item` | Receipt, invoice, or order confirmation, plus a `product_photo` or `package_label`. | [defined] `spec/specs-002.md` |
| EVD-03 | `non_delivery` | Order confirmation plus `tracking_evidence`. | [defined] `spec/specs-002.md` |
| EVD-04 | `delayed_delivery` | Order confirmation or receipt, plus `tracking_evidence`. | [defined] `spec/specs-002.md` |
| EVD-05 | Every submitted file must belong to the claim, be verified as completely uploaded, and pass server-side size, format, and content checks before processing. | [proposed] Create-claim process |
| EVD-06 | Evidence categories and the completeness of a bundle must be checked deterministically before assessment. A filename or customer-declared category alone does not establish evidence type. | [defined] `spec/specs-002.md`; classification is planned |
| EVD-07 | An unreadable, unrelated, incomplete, or missing required document must not be treated as valid evidence. Return a specific, customer-actionable explanation where possible. | [defined] `spec/specs-002.md`; customer process |
| EVD-08 | [proposed] Permit a customer to replace or add evidence only while the claim is `draft`, `uploading`, or explicitly awaiting customer information. Preserve prior submissions and their audit history. | Resubmission behavior needs implementation |
| EVD-09 | [decision needed] Define whether evidence requirements are strict minimums or allow alternatives, exceptions, and supporting evidence by jurisdiction, seller, product, or order type. | Not decided in source documents |

### 3.1 File limits and accepted formats

| ID | Rule | Status / source |
|---|---|---|
| FIL-01 | The current backend accepts PDF, JPEG, PNG, and WebP files, with a 4 MiB per-file limit and at most five files per claim. | [technical constraint] `BlobStorageService` |
| FIL-02 | The current PDF validator accepts one- or two-page PDFs. | [technical constraint] `DocumentExtractionService` |
| FIL-03 | [decision needed] The original customer process says 5 MB and PDF/PNG/JPEG only, which conflicts with the current 4 MiB limit and WebP support. Choose the intended business limit and align portal messaging, API validation, storage configuration, and tests. | Conflict between process draft and backend |
| FIL-04 | [proposed] Enforce actual byte size and file signature, not only the browser-declared MIME type or upload metadata. Treat client-side validation as guidance, not authority. | Create-claim process |
| FIL-05 | [decision needed] Define whether page count, image dimensions, archive formats, password-protected PDFs, and encrypted files have additional limits or are unsupported. | Not fully specified |

## 4. Document safety and evidence understanding

| ID | Rule | Status / source |
|---|---|---|
| SAF-01 | Evidence is uploaded to quarantine and must pass malware scanning before content processing. | [defined] `spec/specs-002.md`; backend flow |
| SAF-02 | A confirmed malware detection blocks that document from evidence processing and promotion. | [defined] Secure processing flow |
| SAF-03 | A scanner outage, missing scan result, or timeout is an operational failure, not proof that the customer's file is malicious. Do not issue a malware-based rejection without a confirmed detection. | [proposed] Create-claim process; fail-closed handling remains required |
| SAF-04 | Content Safety decisions are `PASS`, `REVIEW`, or `BLOCK`. A blocked document must not be promoted or used as clean evidence. | [defined] Existing safety policy and process |
| SAF-05 | A `REVIEW` result is not equivalent to `PASS` or `BLOCK`; it requires a defined human review path before the claim can proceed. | [defined] Process intent; current reviewer handling is incomplete |
| SAF-06 | Classify documents into receipt, invoice, order confirmation, tracking evidence, damage photo, product photo, package label, unreadable, or other. | [defined] `spec/specs-002.md` |
| SAF-07 | A damage-photo classification describes visible content only. It does not prove when, how, or by whom damage occurred, or establish refund eligibility. | [defined] `spec/specs-002.md` |
| SAF-08 | Low classifier confidence must not by itself automatically reject a claim. Route complete but uncertain evidence to human review; request additional information when a required item cannot be established. | [defined] `spec/specs-002.md`; customer process |
| SAF-09 | AI classification and assessment are advisory. Deterministic business rules and authorized human decisions govern eligibility and payment. | [defined] `spec/specs-002.md` |
| SAF-10 | [decision needed] Set and validate confidence thresholds using representative, labeled evidence. Specify whether thresholds vary by evidence category and define the fallback for unavailable or malformed model output. | Thresholds are not yet calibrated |

## 5. Assessment and decision

| ID | Rule | Status / source |
|---|---|---|
| ASM-01 | Evidence must be validated and grounded in applicable refund policy before an assessment is produced. | [defined] Assessment workflow and `spec/specs-002.md` |
| ASM-02 | Policy assertions in an assessment must cite supplied policy passages. Ambiguous or insufficient evidence must be surfaced for review, not represented as a certain fact. | [defined] Assessment workflow |
| ASM-03 | The assessment agent must not approve a claim or execute a refund. | [defined] `spec/specs-002.md` and assessment instructions |
| ASM-04 | Every refund requires human approval. | [defined] `spec/specs-002.md` |
| ASM-05 | The current workflow requires two distinct reviewers when the assessment's proposed amount is greater than 500; otherwise it requires one. | [technical constraint] Current assessment guard and workflow |
| ASM-06 | [decision needed] Confirm the two-reviewer threshold, its currency and amount basis, whether equality at 500 requires one or two reviewers, and whether other risk factors require dual approval. | Current code uses `> 500`; policy is not confirmed |
| ASM-07 | [decision needed] Define whether a reviewer may approve when the assessment marks the claim ineligible, evidence has a safety-review flag, or required criteria are unresolved. Specify any override rationale and approval authority. | Current flow can reach approval with ineligible assessment |
| ASM-08 | Reviewer decisions must be tied to the authenticated reviewer, claim, decision, rationale, and time; duplicate decisions by the same reviewer must not count twice. | [defined] Review flow; append-only audit is recommended |
| ASM-09 | [decision needed] Define reviewer conflict-of-interest rules, reviewer eligibility by claim amount/type, and whether a reviewer may change a submitted decision. | Not decided in source documents |
| ASM-10 | [proposed] Preserve assessment version, policy snapshot/version, model deployment, and prompt version for audit and later dispute review. | Existing assessment contract already carries several of these fields |
| ASM-11 | Agent confidence is a routing signal, not a probability that the claim is eligible and not an approval or rejection threshold by itself. | [proposed] Assessment model confidence is not calibrated in the source documents |
| ASM-12 | A reviewer may approve or reject only after checking the relevant evidence, policy criteria, and amount. Low confidence or missing evidence alone must not be used as proof that a claim is ineligible. | [proposed] Consistent with `spec/specs-002.md` |

### 5.1 Reviewer decision matrix

The matrix below is a proposed decision aid, not an automated decision policy.
The reviewer is accountable for the final decision and must record the evidence and policy basis.
Apply the rows from top to bottom; a higher-priority hold or failure cannot be cancelled by a high agent confidence score or by averaging other scores.

| Priority | Evidence-bundle / policy factors | Agent and document confidence | Recommended disposition | Reviewer action |
|---|---|---|---|---|
| 1. Security hold | Malware scan is pending/errored, a file is quarantined, or required service results are unavailable. | Any score | **Hold processing**, not approve or eligibility-reject. | Wait, retry, or escalate operationally. If a file is confirmed malicious, block that file and follow the approved security policy; request replacement or reject the claim only if policy explicitly requires it. |
| 2. Identity or order gate fails | Order is not owned by the customer, order identity cannot be linked, currency is inconsistent, or the requested/proposed amount exceeds the verified eligible cap. | Any score | **Do not approve.** | Verify source records. Reject only a confirmed policy failure. If evidence is conflicting or fixable, request information or escalate. Ownership and authorization failures are not reviewer-overridable. |
| 3. Safety block | Content Safety is `BLOCK`. | Any score | **Do not use the blocked file as evidence.** | Keep the file blocked. Request safe replacement or follow the documented security/content policy. Do not treat the classifier's claim-eligibility recommendation as overriding the block. |
| 4. Incomplete or unreadable bundle | A required category is missing, unreadable, unrelated, or cannot be verified; required upload or extraction is incomplete. | Any score; low per-document confidence increases concern but is not proof of ineligibility. | **Request information** or **hold for evidence review**. | Identify the missing or unreadable requirement and tell the customer what acceptable evidence could resolve it. Do not reject solely because the model could not read a file. |
| 5. Safety review or evidence ambiguity | Content Safety is `REVIEW`; document classification, damage visibility, dates, order linkage, or extracted fields are ambiguous or inconsistent. | Any score, including high | **Escalate to appropriate human review**; request information if ambiguity is customer-resolvable. | Inspect the original evidence and explanations. Do not proceed to standard approval until the safety/evidence question is resolved. |
| 6. Verified policy failure | Required evidence is present and reliable, but a specific eligibility criterion fails based on a verifiable source and applicable policy citation. | Any score; a high score does not override the source-backed failure. | **Recommend reject**, subject to reviewer confirmation and appeal policy. | Record the failed criterion, evidence document/source, policy citation/version, and customer-facing reason. |
| 7. Strong, consistent support | Required bundle is complete; files pass security and safety checks; order, dates, identity, and amount reconcile; required criteria pass; policy citations are valid and support the assessment; no unresolved contradictions. | Assessment confidence and every required evidence classification are in the calibrated high band. | **Recommend approve**, not auto-approve. | Independently confirm the evidence and approved amount, then submit approval. Apply dual-review requirements where configured. |
| 8. Mixed or weak support | No confirmed disqualifying rule, but one or more criteria are `REVIEW`, sources conflict, citations are weak, extracted values need checking, or confidence is below the calibrated high band. | Medium/low or conflicting confidence | **Escalate, request information, or defer**. | Resolve the specific uncertainty before approving or rejecting. Do not convert an uncertain AI result into a negative finding. |

#### Provisional confidence bands

The following bands are starting points for reviewer routing only.
They are not validated thresholds and must not be used to approve or reject claims until calibrated against representative, labeled cases.

| Score | Provisional interpretation | Reviewer handling |
|---|---|---|
| `0.85` to `1.00` | High model-reported confidence | May support the strong-support path only if every independent evidence, policy, safety, and amount gate also passes. Still requires human approval. |
| `0.60` to `<0.85` | Intermediate confidence | Mandatory closer review of the affected criteria and source documents; request information or escalate if unresolved. |
| `<0.60` | Low confidence | Do not rely on that result to establish a required fact. Inspect the source evidence, request a clearer/alternative document, or escalate. Do not auto-reject. |

Use the assessment confidence and each required document's classification confidence as separate signals.
Do not average them into one score: a low-confidence mandatory document must not be hidden by high confidence on unrelated documents.
The assessment's `confidence` field exists today, but per-document classification confidence is planned and not yet available in the domain contract.

#### Evidence bundle review checklist

For each claim, reviewers should record `PASS`, `REVIEW`, `FAIL`, or `NOT_APPLICABLE` for every factor below, with references to the supporting document IDs.
`FAIL` means the factor is contradicted by reliable evidence or a deterministic rule; inability to verify is `REVIEW`, not `FAIL`.

| Factor | Reviewer checks |
|---|---|
| Claim and order linkage | Authenticated customer owns the order; order ID and purchase details agree across submitted evidence and order records. |
| Required evidence completeness | Required evidence categories for the claim type are present, legible, and associated with this purchase. |
| Evidence classification | Classification category is plausible from the original file; confidence is considered per required document; `other` or `unreadable` does not satisfy a required category. |
| Damage evidence | For `damaged_item`, image shows the relevant product and visible damage. Visible damage alone does not establish cause, timing, or entitlement. |
| Delivery evidence | For `delayed_delivery` or `non_delivery`, tracking/order evidence identifies the relevant shipment and dates. |
| Wrong-item evidence | For `wrong_item`, purchase evidence links to the order and product/package evidence supports the alleged mismatch. |
| Extraction and consistency | Relevant dates, order identifiers, amounts, currency, items, and tracking details extracted from documents agree with one another and trusted order data. OCR/model extraction must be checked against the source when material. |
| Safety and integrity | Malware result is clean; Content Safety is not blocked; any review result is resolved through its designated path; files are intact and readable. |
| Policy grounding | Each material policy conclusion is supported by a valid citation to the applicable policy version. No citation or an unrelated citation means the criterion is unresolved. |
| Eligibility criteria | Identity/order linkage, timeliness, required evidence, amount correctness, and policy eligibility are each assessed explicitly, as required by the assessment instructions. |
| Amount | Approved amount is in the order currency, within the verified eligible amount, and supported by policy and evidence. Record any difference from the customer's request and the agent's proposal. |
| Contradictions and uncertainty | Conflicting evidence, missing context, low confidence, or unresolved safety/evidence questions are documented and routed to review or customer follow-up. |

#### Reviewer outcomes and controls

1. [proposed] Support at least four reviewer dispositions: `approve`, `reject`, `request_information`, and `escalate`. The current review API accepts only `approve` and `reject`, so the other outcomes require implementation.
2. [proposed] Permit `approve` only when there is no unresolved hard gate, no unresolved `FAIL` on a required eligibility criterion, and the final amount passes deterministic validation.
3. [proposed] Permit `reject` only when the reviewer records a confirmed, source-backed policy failure or other explicitly approved rejection ground. Confidence alone is never a rejection ground.
4. [proposed] Use `request_information` when a customer can resolve a missing, unreadable, or conflicting evidence item. Specify the requested item and response deadline.
5. [proposed] Use `escalate` for safety review, policy ambiguity, material evidence conflict, suspected abuse requiring investigation, or an operational exception. Escalation is not a rejection.
6. [decision needed] Define which safety/content flags are security holds, which are customer-remediable, and which may be grounds for claim rejection.
7. [decision needed] Calibrate agent and classifier confidence separately for each claim/evidence category using a representative, reviewed dataset. Measure false approvals, false rejections, calibration error, and reviewer override rates before setting production thresholds.
8. [decision needed] Confirm whether the provisional `0.85` and `0.60` bands are appropriate after calibration; do not treat these draft values as approved policy.

## 6. Refund amount and payment

| ID | Rule | Status / source |
|---|---|---|
| PAY-01 | Refund execution occurs only after the required human approvals. | [defined] Workflow and specification |
| PAY-02 | The refund amount must not exceed the eligible amount paid for the order and must use the order currency. | [defined] Create-claim validation and assessment guard intent |
| PAY-03 | [proposed] Validate the final approved amount again immediately before calling Stripe; do not rely solely on customer input or an AI-proposed amount. | Defense-in-depth |
| PAY-04 | Retried refund requests must be idempotent and must not issue duplicate refunds if the payment provider succeeded but the response was lost. | [proposed] Create-claim process |
| PAY-05 | Stripe webhook events must be signature-verified before changing a claim's payment status. | [defined] `spec/specs-001.md` and webhook process |
| PAY-06 | A claim moves to `refunded` only after a verified success event or equivalent reconciliation. A failed or pending payment must not be shown as refunded. | [defined] Current webhook behavior |
| PAY-07 | [decision needed] Define partial refunds, multiple refund attempts, refund failure recovery, refund cancellation, and what `refund_submitted` means to the customer. | Not decided in source documents |

## 7. Claim lifecycle and customer communication

| ID | Rule | Status / source |
|---|---|---|
| LFC-01 | Claim status represents the overall claim lifecycle; document status represents an individual file's processing lifecycle. Do not conflate the two. | [defined] Domain contract and process |
| LFC-02 | Status changes must follow permitted transitions. A stale request or duplicate activity must not move a claim backward or overwrite a terminal result. | [proposed] Create-claim process |
| LFC-03 | `needs_information` should mean that the customer must provide or correct information. It should not be used to represent an internal service outage. | [proposed] Create-claim process |
| LFC-04 | [decision needed] Define the customer-visible meaning and terminality of `closed`, `pending_ai_capacity`, `refund_failed`, and operational holds. | Backend values exist, customer policy is incomplete |
| LFC-05 | Customers may view only their own claims; reviewers and admins receive access according to their assigned roles. | [defined] API contract and claim process |
| LFC-06 | [proposed] Notify the customer when action is required, a final decision is reached, or a refund is submitted/completed/failed. Notifications must not expose sensitive evidence or payment details. | Current email coverage is partial |
| LFC-07 | [decision needed] Choose initial status-update channel (polling, email, or both), notification timing, language, and retry policy. | Push notifications are not implemented |
| LFC-08 | [decision needed] Define customer response deadlines, reminder cadence, claim expiry, appeal/reopen rules, and the applicable timezone/calendar rules. | Not decided in source documents |

## 8. Data protection, audit, and operations

| ID | Rule | Status / source |
|---|---|---|
| OPS-01 | Keep uploaded evidence quarantined until it passes the required security and content checks. Only clean, permitted evidence is promoted to the evidence container. | [defined] Evidence processing flow |
| OPS-02 | [decision needed] Define separate retention periods for incomplete uploads, quarantined files, clean evidence, extracted text, assessments, and audit records. Include legal holds and deletion behavior. | Source process mentions seven-day cleanup, but its scope and applicability are unclear |
| OPS-03 | [proposed] Record status transitions and material decisions with actor/component, timestamp, claim/document/workflow IDs, reason, and correlation ID. Keep the audit history append-only. | Auditability recommendation |
| OPS-04 | Do not log upload grant URLs, access tokens, credentials, full document content, or unnecessary personal data. Treat signed upload URLs as bearer credentials. | [proposed] Security and privacy control |
| OPS-05 | [proposed] Use bounded retries and operational alerts for service failures. Persist enough state to reconcile stuck submissions, workflows, malware checks, refunds, and notifications. | Reliability recommendation |
| OPS-06 | A service outage must fail closed for evidence promotion and payment, but must be represented as an operational hold rather than a false customer eligibility or malware decision. | [defined] `spec/specs-002.md` risk; create-claim process |
| OPS-07 | [decision needed] Define support escalation ownership, service-level objectives, manual retry permissions, and audit requirements for operator overrides. | Not decided in source documents |

## 9. Decisions to resolve before production

1. Confirm file limits and accepted formats, including the 4 MiB versus 5 MB discrepancy and WebP support.
2. Confirm duplicate-claim policy, eligible order age, claim filing deadlines, and customer withdrawal/edit rights.
3. Confirm required evidence alternatives and exceptions for each claim type.
4. Calibrate agent and evidence-classifier confidence separately; confirm or replace the provisional reviewer-routing bands.
5. Confirm the dual-review threshold and the override policy for ineligible or safety-flagged assessments.
6. Define final refund amount rules, partial refunds, and refund failure recovery.
7. Define customer response deadlines, appeals, notification behavior, status vocabulary, and claim closure rules.
8. Define retention periods, legal holds, operational alerts, and manual recovery permissions.

## 10. Source traceability

| Source | Rules informed |
|---|---|
| `spec/specs-001.md` | API identity, role-based access, webhook signature verification, API contract boundaries |
| `spec/specs-002.md` | Evidence categories, evidence bundles, safety/classification requirements, human approval, AI non-goals, failure handling |
| `processes/create_claim.md` | Customer journey, order and amount validation, uploads, processing, claim states, notifications, reliability gaps |
| `processes/review_claim.md` | Current claim/document statuses and review-oriented notes |
| Current backend domain and API models | Claim types, request constraints, amount/currency checks, upload limits, reviewer threshold, payment state handling |