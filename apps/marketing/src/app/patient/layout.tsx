import "./globals.css";

import { Providers } from "@/portal/components/Providers";
import { AuthBoot } from "@/portal/components/AuthBoot";

/**
 * Patient portal root layout.
 *
 * Co-exists under the marketing app — the marketing root layout owns
 * <html>/<body>, so we only emit a wrapper. That wrapper carries
 * `data-app="patient"`, which every style rule in globals.css is
 * scoped to, keeping the indigo system out of marketing and out of
 * the clinician portal.
 *
 * Role gating deliberately does NOT happen here: /login (patient port) and
 * /patient/403 must render for signed-out and wrong-role visitors.
 * The gate lives in (app)/layout.tsx.
 */
export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-app="patient">
      <Providers>
        <AuthBoot>{children}</AuthBoot>
      </Providers>
    </div>
  );
}