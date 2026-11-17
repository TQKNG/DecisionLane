import type { NextConfig } from "next";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

const NEXT_CONFIG: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // Static hosting rewrites /claims/<id>/ and /review/<id>/ to their detail shells (public/staticwebapp.config.json).
  // Static export does not support rewrites, so the dev server mirrors that rule only in development.
  ...(IS_DEVELOPMENT && {
    async rewrites() {
      return [
        { source: "/claims/:claimId((?!new$|detail$)[^/]+)/", destination: "/claims/detail/" },
        { source: "/review/:claimId((?!detail$)[^/]+)/", destination: "/review/detail/" },
      ];
    },
  }),
};

export default NEXT_CONFIG;
