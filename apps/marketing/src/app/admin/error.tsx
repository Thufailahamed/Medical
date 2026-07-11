"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Admin portal error:", error);
  }, [error]);

  return (
    <div className="min-h-screen grid place-items-center text-text">
      <div className="bg-surface border border-border rounded-2xl p-10 max-w-md text-center">
        <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-danger-soft text-red-700 grid place-items-center">
          <AlertTriangle size={22} />
        </div>
        <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
        <p className="text-sm text-text-soft mb-6">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
          >
            Try again
          </button>
          <Link
            href="/admin/dashboard"
            className="h-10 px-4 rounded-xl border border-border hover:bg-surface-2 text-sm font-semibold grid place-items-center"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}