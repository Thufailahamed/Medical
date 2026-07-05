import "./globals.css";

import { Providers } from "@/portal/components/Providers";
import { AuthBoot } from "@/portal/components/AuthBoot";

/**
 * Portal root layout.
 *
 * Co-exists under the marketing app — we don't emit `<html>/<body>`
 * (the marketing root layout owns those). We DO:
 *   1. Import portal CSS so Tailwind v4 utilities + `--color-*` tokens
 *      resolve inside the [data-app="portal"] subtree only.
 *   2. Wrap children in `<div data-app="portal">` so design tokens and
 *      scrollbar/focus styles don't bleed into marketing pages.
 *   3. Mount Providers (TanStack Query + Toast) and AuthBoot (/auth/me).
 *
 * Role-based gating happens in the (portal) route group layout.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-app="portal">
      <Providers>
        <AuthBoot>{children}</AuthBoot>
      </Providers>
    </div>
  );
}
