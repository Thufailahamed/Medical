import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/**
 * /portal/me/* → /patient/* consolidation redirects.
 *
 * Exported as a static helper so the redirects list is unit-testable
 * without spinning up a Next dev server. Each entry maps to a
 * `redirects()` config block via the helper below.
 */
export interface RedirectEntry {
  source: string;
  destination: string;
  permanent: boolean;
}

export function consolidationRedirects(): RedirectEntry[] {
  return [
    { source: "/portal/me/insurance", destination: "/patient/insurance", permanent: true },
    { source: "/portal/me/insurance/marketplace", destination: "/patient/insurance/marketplace", permanent: true },
    { source: "/portal/me/insurance/marketplace/:providerId", destination: "/patient/insurance/marketplace/:providerId", permanent: true },
    { source: "/portal/me/insurance/plans/:planId", destination: "/patient/insurance/plans/:planId", permanent: true },
    { source: "/portal/me/insurance/quote", destination: "/patient/insurance/quote", permanent: true },
    { source: "/portal/me/insurance/enroll/:planId", destination: "/patient/insurance/enroll/:planId", permanent: true },
    { source: "/portal/me/insurance/payment/:enrollmentId", destination: "/patient/insurance/payment/:enrollmentId", permanent: true },
    { source: "/portal/me/insurance/policy/:id", destination: "/patient/insurance/policy/:id", permanent: true },
    { source: "/portal/me/insurance/ecard/:id", destination: "/patient/insurance/ecard/:id", permanent: true },
    { source: "/portal/me/insurance/coverage-check", destination: "/patient/insurance/coverage-check", permanent: true },
    { source: "/portal/me/insurance/claims", destination: "/patient/insurance/claims", permanent: true },
    { source: "/portal/me/insurance/claims/new", destination: "/patient/insurance/claims/new", permanent: true },
    { source: "/portal/me/insurance/claims/:id", destination: "/patient/insurance/claims/:id", permanent: true },
    { source: "/portal/me/share", destination: "/patient/share", permanent: true },
    { source: "/portal/me/audit", destination: "/patient/audit", permanent: true },
    { source: "/portal/me/imaging", destination: "/patient/imaging", permanent: true },
    { source: "/portal/me/imaging/:studyUid", destination: "/patient/imaging/:studyUid", permanent: true },
    { source: "/portal/me/records", destination: "/patient/records", permanent: true },
    { source: "/portal/me/notifications", destination: "/patient/notifications", permanent: true },
  ];
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  transpilePackages: ["recharts"],
  async redirects() {
    return consolidationRedirects();
  },
};

export default nextConfig;
