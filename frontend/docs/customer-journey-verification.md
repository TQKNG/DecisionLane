# Customer claim journey verification

Use this checklist to verify the customer refund claim journey locally and in a deployed environment.
It covers sign-in, an owned order, evidence upload, submission, and status display.
Use synthetic data only: never use real customer orders, payment references, or personal files.

## 1. Configuration

### Frontend

| Variable | Local | Deployed |
| --- | --- | --- |
| `NEXT_PUBLIC_ENTRA_TENANT_ID` | Tenant ID | GitHub variable `AZURE_TENANT_ID` |
| `NEXT_PUBLIC_ENTRA_CLIENT_ID` | SPA app registration client ID | GitHub variable `SPA_CLIENT_ID` |
| `NEXT_PUBLIC_API_SCOPE` | `api://<api-client-id>/access_as_user` | Same |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | GitHub variable `API_BASE_URL` |

### Entra redirect URIs

The SPA registration must list both origins as single-page application redirect URIs.
Check them without changing anything:

```bash
az ad app show --id "$SPA_CLIENT_ID" --query "spa.redirectUris"
```

Expected: `http://localhost:3000` and `https://<static-web-app-host>`.
GUIDE.md shows how to set them if either is missing.

### Customer role

The test account must hold the `Customer` app role on the API registration.
Check the assignment:

```bash
API_SP_ID=$(az ad sp show --id "$API_CLIENT_ID" --query id -o tsv)
az rest --method GET --url "https://graph.microsoft.com/v1.0/servicePrincipals/$API_SP_ID/appRoleAssignedTo" \
  --query "value[].{principal: principalDisplayName, role: appRoleId}"
```

Compare `appRoleId` with the `Customer` role ID from `az ad app show --id "$API_CLIENT_ID" --query "appRoles"`.
After a new assignment, sign out and sign in again so the access token carries the role.

### API and storage CORS

- The API reads `ALLOWED_ORIGINS` (comma separated).
  Locally, set it in the backend environment, for example `ALLOWED_ORIGINS=http://localhost:3000`.
  In Azure, `infra/main.bicep` sets it on the API container app to the Static Web App origin, plus `localFrontendOrigin` in `dev`.
- Blob Storage needs a CORS rule for browser uploads.
  `infra/main.bicep` configures it for Azure; for Azurite, see the frontend README.
- Static Web App staging and preview hostnames are not allowed origins, so verify against the production hostname.
- CORS changes take effect only after the infrastructure is deployed.

### Claim detail URLs

Claim pages use `/claims/<id>/`.
Static export cannot pre-render every claim, so `public/staticwebapp.config.json` rewrites those paths to `/claims/detail/`, and `next.config.ts` mirrors the rule in `next dev`.

## 2. Provision an owned test order

Customers enter an existing order ID, and the API accepts a claim only for an order owned by the signed-in customer.
Create a synthetic order with an account that holds the `Admin` role.

1. Find the customer's Entra object ID, which becomes `customer_id`:

   ```bash
   az ad user show --id "<test-customer-upn>" --query id -o tsv
   ```

2. Get an access token for an Admin account with the API scope, then create the order:

   ```bash
   curl -sS -X POST "$API_BASE_URL/v1/admin/orders" \
     -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"id": "smoke-order-001", "customer_id": "<customer-object-id>", "currency": "CAD", "paid_amount": 50, "payment_intent_id": "<stripe-test-mode-payment-intent>"}'
   ```

   - A `409` response means the order ID already exists; pick a new ID such as `smoke-order-002`.
   - Use a Stripe test mode payment intent if you want the refund step to succeed.
     A placeholder reference lets you verify everything up to approval, but the refund then shows as delayed.
   - Keep tokens in your shell only and never commit them.

3. Prepare one or two small synthetic evidence files, for example a PNG screenshot of a blank page or a one-page PDF, under 4 MB each.

## 3. Smoke checklist

Run the checklist once locally (`pnpm dev` with the local API) and once against the deployed Static Web App.

### Sign-in and claims list

- [ ] Signed out, `/` and `/sign-in/` load, and **Continue with Microsoft** opens Microsoft sign-in.
- [ ] After sign-in from `/sign-in/`, the browser lands on `/dashboard/`.
- [ ] The claims list shows only the test customer's claims, or the **No claims yet** state.
- [ ] An account without the `Customer` role sees **You do not have access**, with an option to sign in with a different account.
- [ ] With the API stopped, the list shows **We could not connect** and **Try again** recovers once the API is back.

### Create and submit

- [ ] **New claim** opens `/claims/new/`.
- [ ] Submitting the empty form shows the error summary, which takes focus and links to each field.
- [ ] A `.docx` or a file over 4 MB is refused with a reason; a sixth file is refused.
- [ ] Entering an order ID that is not owned shows **We could not find this order on your account**.
- [ ] With `smoke-order-001`, a valid amount, a description, and the evidence files, **Submit claim** shows each file move through Uploading, Verifying, and Verified, then **Claim submitted**.
- [ ] In the browser network panel, the Blob `PUT` carries `x-ms-blob-type` and `Content-Type` and no `Authorization` header.

### Status tracking

- [ ] **View claim status** opens `/claims/<id>/` with the claim details and current status.
- [ ] While the status is active (for example **Checking evidence**), the page refreshes about every 3 seconds; it stops once the status is final or waiting on the customer.
- [ ] Reloading `/claims/<id>/` directly loads the same claim. In the deployed site this verifies the Static Web App rewrite.
- [ ] `/claims/does-not-exist/` shows **We could not find this claim**.
- [ ] The claim appears in the list with the same status, and its ID links back to the detail page.

### Presentation and access

- [ ] Each screen works at desktop width and at about 390px, with no horizontal scrolling.
- [ ] Each screen works in light, dark, and system themes.
- [ ] Keyboard only: every link, field, file chooser, and button is reachable with Tab and shows a visible focus ring.
- [ ] Production export: `pnpm build` produces `out/claims/detail/index.html` and `out/staticwebapp.config.json`.

## 4. Known limitations

- The API cannot remove or replace an uploaded document, and submission requires every document to be verified.
  If verification rejects a file, or an upload grant expires before a retry, that claim stays in draft and the customer starts a new claim.
- Draft editing, persisted file previews, and an activity timeline are out of scope.
