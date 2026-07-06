"use client";

/**
 * Authenticated-portal error boundary.
 *
 * Catches errors that happen inside the (portal) route group —
 * i.e. AFTER the layout has rendered the sidebar + topbar shell.
 * Keeps the shell intact so the user doesn't lose their navigation
 * context when a single page blows up.
 *
 * Sits BELOW `apps/marketing/src/app/portal/error.tsx` (which catches
 * errors during auth-gating or layout rendering). Layout errors
 * surface through the outer boundary with no shell; page-level
 * errors surface here WITH the shell.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RotateCw, ArrowLeft } from "lucide-react";

import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";

export default function PortalPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[portal/page] error boundary caught:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <Card padding={false}>
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text">Page error</h2>
      </div>
      <div className="px-6 py-12 flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-3">
          <AlertOctagon size={22} />
        </div>
        <p className="text-sm text-text-soft max-w-md">
          We hit an error rendering this page. The rest of the portal
          is still working — you can navigate elsewhere or retry.
        </p>
        {error.digest ? (
          <code className="mt-3 text-[10px] text-text-muted font-mono bg-surface-2 px-2 py-1 rounded">
            ref: {error.digest}
          </code>
        ) : null}
        <div className="mt-5 flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<RotateCw size={13} />}
            onClick={reset}
          >
            Try again
          </Button>
          <Link href="/portal/dashboard">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={13} />}>
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}