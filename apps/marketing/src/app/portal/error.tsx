"use client";

/**
 * Root portal error boundary.
 *
 * Catches uncaught render errors from anywhere under /portal/* that
 * doesn't have its own closer boundary. The `reset` callback lets
 * users retry the action that triggered the error without losing
 * their place. Errors are logged to the console with a stable digest
 * for support tickets; the actual API error message is intentionally
 * hidden from end users (avoid leaking PHI / stack traces).
 *
 * Next.js 16 contract: error boundaries MUST be client components.
 * They receive { error, reset } — see
 * https://nextjs.org/docs/app/api-reference/file-conventions/error
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RotateCw, ArrowLeft } from "lucide-react";

import { Button } from "@/portal/components/ui/Button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Stable server-side digest is logged so support can correlate.
    // The actual Error object isn't shipped to Sentry/etc yet — wire
    // that up in a follow-up if/when telemetry is added.
    // eslint-disable-next-line no-console
    console.error("[portal] error boundary caught:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <div className="h-14 w-14 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-4">
        <AlertOctagon size={26} />
      </div>
      <h1 className="text-lg font-semibold text-text">
        Something went wrong
      </h1>
      <p className="text-sm text-text-soft mt-1 max-w-md">
        We couldn't load this page. The error has been logged — if it
        keeps happening, share the reference below with support.
      </p>
      {error.digest ? (
        <code className="mt-3 text-[11px] text-text-muted font-mono bg-surface-2 px-2 py-1 rounded">
          ref: {error.digest}
        </code>
      ) : null}
      <div className="mt-6 flex items-center gap-2">
        <Button
          variant="primary"
          leftIcon={<RotateCw size={14} />}
          onClick={reset}
        >
          Try again
        </Button>
        <Link href="/portal/dashboard">
          <Button variant="ghost" leftIcon={<ArrowLeft size={14} />}>
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}