import type { NextConfig } from "next";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

const NEXT_CONFIG: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // Static hosting rewrites /claims/<id>/ to the claim detail shell (public/staticwebapp.config.json).
  // Static export does not support rewrites, so the dev server mirrors that rule only in development.
  ...(IS_DEVELOPMENT && {
    async rewrites() {
      return [{ source: "/claims/:claimId((?!new$|detail$)[^/]+)/", destination: "/claims/detail/" }];
    },
  }),
};

export default NEXT_CONFIG;
