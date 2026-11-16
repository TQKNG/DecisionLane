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
