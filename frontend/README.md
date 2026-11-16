# DecisionLane frontend

This is the frontend foundation for DecisionLane.
It currently provides Microsoft Entra ID sign-in, a minimal authenticated shell, Redux Toolkit/RTK Query state-management scaffolding, and shadcn/ui-style components for future features.

The app is configured for a static export, uses client-side MSAL authentication, and supports light, dark, and system themes.

## Environment

Configure these public variables before enabling live sign-in:

```text
NEXT_PUBLIC_ENTRA_CLIENT_ID=
NEXT_PUBLIC_ENTRA_TENANT_ID=
NEXT_PUBLIC_API_SCOPE=
NEXT_PUBLIC_API_BASE_URL=
```

`NEXT_PUBLIC_API_BASE_URL` is the DecisionLane API origin, for example `http://localhost:8000` locally or the deployed API host.
`NEXT_PUBLIC_API_SCOPE` is the delegated API scope, for example `api://<api-client-id>/access_as_user`.
When either value is missing, signed-in screens explain that the API is not configured instead of showing placeholder data.
The API must list the frontend origin in its `ALLOWED_ORIGINS` setting.

## Evidence uploads

The browser uploads evidence files directly to the quarantine Blob container.
For each file it uses the short-lived grant from `POST /v1/claims/{claim_id}/uploads`, then asks the API to verify the upload before the claim is submitted.
The upload request goes to Blob Storage, so the storage account needs a CORS rule for the frontend origin.

- Deployed environments: `infra/main.bicep` allows `PUT` from the Static Web App hostname, and in `dev` also from `localFrontendOrigin` (default `http://localhost:3000`).
  Static Web App staging and preview hostnames are not included.
- Local development against Azurite: Azurite does not read Bicep, so add a matching rule once, for example:

  ```bash
  az storage cors add --services b --methods PUT OPTIONS \
    --origins http://localhost:3000 \
    --allowed-headers content-type x-ms-blob-type x-ms-version x-ms-client-request-id \
    --exposed-headers x-ms-request-id etag --max-age 3600 \
    --connection-string "UseDevelopmentStorage=true"
  ```

Known limitation: the API has no way to remove or replace an uploaded document, and a claim can be submitted only when every document is verified.
If a file is rejected during verification, or its upload grant expires before a retry, that claim stays in draft.
The customer can start a new claim instead.

## Development

```bash
pnpm install
pnpm dev
```

The development server runs at `http://localhost:3000`.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
