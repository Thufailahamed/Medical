"use client";

import Link from "next/link";

import { Card } from "@/patient/components/primitives/Card";
import { cn } from "@/portal/lib/utils";

/**
 * CareAssistant — a low-stakes prompt row at the bottom of the
 * dashboard. The card never invents advice; it points at the right
 * page for the patient to act on the surface they already have.
 */
export function CareAssistant({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "anim-rise flex items-center justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        <p className="t-label">Care assistant</p>
        <p className="mt-1 text-sm text-text-soft">
          Ask a question about your plan, your medicines, or what's next.
        </p>
      </div>
      <Link
        href="/patient/messages"
        className="bg-brand px-4 py-2 text-sm font-semibold text-white"
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        Open chat
      </Link>
    </Card>
  );
}
