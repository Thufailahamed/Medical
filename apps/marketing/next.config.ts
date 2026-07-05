import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const nextConfig: NextConfig = {
  // The portal (apps/marketing/src/app/portal/*) talks to the API over
  // HTTP via lib/api.ts. No server-side proxies are needed in dev
  // because the API has CORS configured. In prod the portal and API
  // sit on the same origin so this is moot.
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  // Recharts (a transitive dep) still ships CommonJS that needs the
  // transpilePackages escape hatch under Next 16.
  transpilePackages: ["recharts"],
};

export default nextConfig;