import "./globals.css";

import { Providers } from "@/hospital/components/Providers";
import { AuthBoot } from "@/hospital/components/AuthBoot";

/**
 * Hospital portal root layout.
 *
 * Mirrors the doctor portal layout:
 *   1. Import hospital CSS so Tailwind v4 utilities + design tokens
 *      resolve under [data-app="hospital"].
 *   2. Wrap children in <div data-app="hospital"> so scoping is clean.
 *   3. Mount Providers (TanStack Query + Toast) and AuthBoot (/auth/me).
 *
 * Role-based gating happens in the (hospital) route group layout.
 */
export default function HospitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-app="hospital">
      <Providers>
        <AuthBoot>{children}</AuthBoot>
      </Providers>
    </div>
  );
}