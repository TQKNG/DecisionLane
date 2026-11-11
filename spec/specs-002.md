# Specification: RefundFlow Evidence Understanding and Damage Validation

## 1. Metadata

| Field | Value |
|---|---|
| ID | specs-002 |
| Status | Ready for implementation |
| Type | Backend capability and AI service integration |
| Scope | Evidence classification, claim-type validation, and related deployment |
| Primary implementation | backend/function_app.py, backend/functions/services.py, backend/src/refundflow |
| Dependencies | Blob quarantine, Defender for Storage, Content Safety, Document Intelligence, Cosmos DB |
| External service | Existing Microsoft Foundry resource with Content Understanding |

## 2. Context

The current backend validates file format, file size, PDF page count, malware status, content safety, and general text extraction.
It does not determine whether an uploaded file is the correct evidence for the selected claim type.

The new capability must classify PDF and image evidence, detect whether a damage image visibly shows damage, and validate the complete evidence bundle.
It must not automatically approve a refund.
Human approval remains mandatory for every refund decision.

The current processing entry point is backend/function_app.py:process_document.
Shared activity clients are created in backend/functions/services.py.
The document and extraction contracts are in backend/src/refundflow/domain/models.py.

## 3. Goals and non-goals

### Goals

- Classify receipts, invoices, order confirmations, tracking evidence, product photos, package labels, and damage photos.
- Return confidence, quality, and reviewer-readable reasoning.
- Validate evidence bundles against the claim type.
- Route missing, unrelated, unreadable, or low-confidence evidence to needs_information or human review.
- Preserve the existing malware, Content Safety, Document Intelligence, and human approval controls.
- Make deployment and verification repeatable.

### Non-goals

- Automatically approving or paying refunds.
- Replacing Document Intelligence for deterministic receipt and invoice extraction.
- Adding a separate Azure AI Vision resource for the first implementation.
- Treating a visible-damage result as proof of causation or customer eligibility.
- Changing the direct-to-Blob upload contract.

## 4. Current state and requirements

### 4.1 Processing sequence

~~~text
direct upload to Blob quarantine
  -> Defender for Storage malware scan
  -> Content Safety analysis
  -> Content Understanding classification
  -> Document Intelligence extraction
  -> evidence-bundle validation
  -> clean evidence promotion
  -> claim assessment and human approval
~~~

Classification must run after Content Safety passes and before clean evidence is promoted.
Document Intelligence remains the deterministic extraction path for receipts and invoices.

### 4.2 Evidence requirements

| Claim type | Minimum evidence |
|---|---|
| damaged_item | A receipt or invoice, plus a damage_photo |
| wrong_item | A receipt, invoice, or order confirmation, plus a product_photo or package_label |
| non_delivery | An order confirmation, plus tracking_evidence |
| delayed_delivery | An order confirmation or receipt, plus tracking_evidence |

The classifier categories are:

~~~text
receipt
invoice
order_confirmation
tracking_evidence
damage_photo
product_photo
package_label
unreadable
other
~~~

For damage_photo, return shows_product, damage_visible, damage_type, image_quality, confidence, and reason.
The result describes visible evidence only.

### 4.3 Service decision

Use Azure Content Understanding with production API version 2025-11-01 as the multimodal classifier.
Use its custom analyzer and classification capabilities for PDF and image evidence.
Keep Azure Document Intelligence for structured receipt and invoice extraction.
Add Azure AI Vision only later if specialized object detection, bounding boxes, or a dedicated trained vision model becomes necessary.

References:

- [Azure Content Understanding overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview)
- [Content Understanding classifier](https://learn.microsoft.com/azure/ai-services/content-understanding/concepts/classifier)
- [Document Intelligence and Content Understanding comparison](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept/choose-model-feature?preserve-view=tru&view=doc-intel-3.1.0)

## 5. Implementation plan

### 5.1 Deploy or verify the Foundry resource

Reuse the existing Foundry resource from the project setup.
Do not create a second standalone Computer Vision account.

~~~bash
export FOUNDRY_RESOURCE_GROUP='rg-foundry-models'
export FOUNDRY_RESOURCE_NAME='fd-resource-dev'
export CONTENT_UNDERSTANDING_API_VERSION='2025-11-01'

export CONTENT_UNDERSTANDING_ENDPOINT=$(az cognitiveservices account show \
  --resource-group "$FOUNDRY_RESOURCE_GROUP" \
  --name "$FOUNDRY_RESOURCE_NAME" \
  --query properties.endpoint \
  -o tsv)

printf '%s\n' "$CONTENT_UNDERSTANDING_ENDPOINT"
~~~

Create an analyzer named refund_evidence_classifier in Content Understanding Studio or through the REST API.
Include an explicit other category so unrelated files are not forced into a valid category.

~~~bash
export CU_TOKEN=$(az account get-access-token \
  --resource https://cognitiveservices.azure.com/ \
  --query accessToken \
  -o tsv)

curl -sS -X PUT \
  "\${CONTENT_UNDERSTANDING_ENDPOINT}/contentunderstanding/analyzers/refund_evidence_classifier?api-version=\${CONTENT_UNDERSTANDING_API_VERSION}" \
  -H "Authorization: Bearer $CU_TOKEN" \
  -H "Content-Type: application/json" \
  --data @infra/refund-evidence-classifier.json
~~~

Create infra/refund-evidence-classifier.json with categories for receipts, invoices, order confirmations, tracking evidence, damage photos, product photos, package labels, unreadable files, and other files.
For damage_photo, require fields for damage_visible, damage_type, image_quality, confidence, and reason.
Confirm the current request schema against the official classifier documentation before deployment.

### 5.2 Configure infrastructure and identity

Add these settings to backend/src/refundflow/config.py:

~~~python
content_understanding_endpoint: str = ""
content_understanding_analyzer_id: str = "refund_evidence_classifier"
content_understanding_api_version: str = "2025-11-01"
~~~

Add the same values to local settings and the API and Function App app-settings arrays in infra/main.bicep.
Do not edit infra/main.json manually because it is generated from Bicep.

~~~bicep
{ name: 'CONTENT_UNDERSTANDING_ENDPOINT', value: foundryResourceEndpoint }
{ name: 'CONTENT_UNDERSTANDING_ANALYZER_ID', value: 'refund_evidence_classifier' }
{ name: 'CONTENT_UNDERSTANDING_API_VERSION', value: '2025-11-01' }
~~~

If the Foundry resource is external to the application resource group, pass its endpoint as a deployment parameter.

Grant both managed identities access to the existing Foundry resource:

~~~bash
export FOUNDRY_RESOURCE_ID=$(az cognitiveservices account show \
  --resource-group "$FOUNDRY_RESOURCE_GROUP" \
  --name "$FOUNDRY_RESOURCE_NAME" \
  --query id -o tsv)

for principal_id in "$API_PRINCIPAL_ID" "$FUNCTION_PRINCIPAL_ID"
do
  az role assignment create \
    --assignee-object-id "$principal_id" \
    --assignee-principal-type ServicePrincipal \
    --role 'Cognitive Services User' \
    --scope "$FOUNDRY_RESOURCE_ID"
done
~~~

### 5.3 Add the domain contract

Add EvidenceClassification to backend/src/refundflow/domain/models.py:

~~~python
class EvidenceClassification(BaseModel):
    evidence_type: str
    confidence: float = Field(ge=0, le=1)
    image_quality: str
    shows_product: bool | None = None
    damage_visible: bool | None = None
    damage_type: str | None = None
    reason: str
    validation_status: str
~~~

Add evidence_type, evidence_confidence, and evidence_validation to ClaimDocument.
Persist the full classification as a ClaimAggregateItem with an ID such as classification:{document_id}.

### 5.4 Implement and register the service

Create backend/src/refundflow/services/content_understanding.py.
Use DefaultAzureCredential and an asynchronous HTTP client or the supported Azure SDK.
Expose asynchronous analyze and close methods.
Validate every response against EvidenceClassification.
Fail closed on malformed output or unknown categories.

Instantiate the service in backend/functions/services.py.
Close it in ActivityServices.close() with the other asynchronous clients.

### 5.5 Integrate document processing

Update process_document() in backend/function_app.py:

~~~text
download quarantined Blob
  -> Content Safety
  -> Content Understanding classification
  -> Document Intelligence extraction
  -> persist classification and extraction
  -> promote clean evidence
~~~

For damage_photo, persist the classification even when damage_visible is false so reviewers can see why more evidence was requested.
Do not promote a file blocked by Content Safety.
Do not automatically reject an entire claim because one document is low confidence.

### 5.6 Validate the evidence bundle

Add deterministic validation after all documents have been processed.
For damaged_item, require a receipt or invoice and a damage_photo with damage_visible equal to true.
For wrong_item, require purchase evidence and a product image or package label.
For non_delivery and delayed_delivery, require order evidence and tracking evidence.

If the bundle is incomplete, unreadable, unrelated, or below the configured confidence threshold, set the claim to needs_information and persist a human-readable reason.
Keep complete but uncertain evidence in the human-review path.

## 6. Task breakdown

| Task | Depends on | Owned files | Completion evidence |
|---|---|---|---|
| EVID-01: Create the Content Understanding analyzer | None | infra/refund-evidence-classifier.json | Analyzer exists with all categories and damage fields |
| EVID-02: Add settings and deployment configuration | EVID-01 | backend/src/refundflow/config.py, infra/main.bicep, local settings | Both workloads receive endpoint, analyzer ID, and API version |
| EVID-03: Add the classification domain model | None | backend/src/refundflow/domain/models.py | Validated classification contract and persisted document fields |
| EVID-04: Implement the service client | EVID-02, EVID-03 | backend/src/refundflow/services/content_understanding.py, backend/functions/services.py | Mocked service tests pass and clients close cleanly |
| EVID-05: Integrate document processing | EVID-04 | backend/function_app.py | Classification is persisted before promotion |
| EVID-06: Add bundle validation | EVID-03, EVID-05 | backend/src/refundflow, backend/function_app.py | Each claim type follows its evidence rule |
| EVID-07: Add fixtures and end-to-end tests | EVID-05, EVID-06 | backend/tests/, tests/e2e/ | Positive, negative, and low-confidence paths are verified |

Workers must not modify shared infrastructure or task ledgers unless the coordinator assigns those files.
Each handoff must state the baseline, owned files, changes, checks, evidence, integration needs, and unresolved issues.

## 7. Verification

### 7.1 Unit tests

Add tests under backend/tests/unit/ for valid and invalid classification responses, unknown categories, malformed service responses, clear damage photos, undamaged product photos, unrelated images, unreadable files, each claim-type rule, and low-confidence routing.
Mock Content Understanding responses.
Do not call Azure from unit tests.

### 7.2 Integration tests

Use fixtures for a receipt PDF, invoice image, clear damage image, undamaged product image, tracking screenshot, unrelated image, and blurry image.
Verify classification type, confidence, latency, persistence, and final validation result.

### 7.3 End-to-end tests

Submit a damaged-item claim with a receipt and clear damage image.
Confirm classification and extraction items are written to Cosmos DB.
Confirm a complete bundle reaches human review.
Submit a damaged-item claim with an unrelated image and confirm the claim becomes needs_information without creating a refund.
Submit a low-confidence damage image and confirm it remains in the human-review path.

### 7.4 Deployment checks

~~~bash
az bicep build --file infra/main.bicep
cd backend
source .venv/bin/activate
python -m pip install --no-deps --editable .
ruff check .
mypy src api
pytest -q
cd ..
~~~

Run the deployment and managed-identity verification commands from GUIDE.md sections 8 and 9 after the Bicep settings are updated.

## 8. Acceptance criteria

- [ ] PDF and image evidence are classified into supported categories.
- [ ] Damage images return visibility, quality, confidence, damage type, and a reviewer-readable reason.
- [ ] Claim-type evidence requirements are enforced deterministically.
- [ ] Low-confidence evidence routes to human review or needs_information.
- [ ] No classifier result directly approves or pays a refund.
- [ ] Classification results are persisted with claim and document IDs.
- [ ] Existing Document Intelligence extraction continues to work.
- [ ] Unit, integration, and end-to-end tests pass.
- [ ] Deployment uses the existing Foundry resource and managed identity access.

## 9. Risks and decisions

- Content Understanding describes visible evidence but does not prove causation or entitlement.
- Confidence thresholds must be calibrated with labeled fixtures before production use.
- The analyzer schema may evolve with the API version and must be validated during deployment.
- A service outage must fail closed into a reviewable processing state, not silently accept evidence.
- A checked-in analyzer definition must be versioned with the backend contract.

## 10. Handoff

Start with EVID-01 and EVID-02.
Then implement EVID-03 through EVID-06 in dependency order.
Run EVID-07 only after the coordinator integrates the shared model, service registration, and workflow changes.
The frontend recovery and evidence-review UI should follow this specification as a separate task group.
