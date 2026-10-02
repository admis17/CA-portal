import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Client document uploads post files to a server action (max 25 MB per file).
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
};

export default nextConfig;
