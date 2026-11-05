import type { NextConfig } from "next";

const NEXT_CONFIG: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default NEXT_CONFIG;