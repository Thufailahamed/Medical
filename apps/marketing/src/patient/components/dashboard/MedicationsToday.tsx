"use client";

import Link from "next/link";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useMedicationsToday } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

export function MedicationsToday({ className }: { className?: string }) {
  const query = useMedicationsToday();
  return (
    <Card className={cn("anim-rise", className)}>
      <div className="flex items-end justify-between">
        <div>
          <p className="t-label">Today's medications</p>
          <p className="t-card-title mt-1">Up next</p>
        </div>
        <Link
          href="/patient/medications"
          className="text-xs font-medium text-text-soft hover:text-text"
        >
          View all
        </Link>
      </div>

      <QueryBoundary
        query={query as any}
        emptyTitle="Nothing scheduled today"
        emptyDescription="You'll see doses here once your doctor issues an active plan."
        className="mt-4 flex flex-col gap-2"
      >
        {(data) => (
          <ul className="flex flex-col gap-2">
            {data.medicines.slice(0, 4).map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-inner bg-surface-2 px-3 py-2"
              >
                <span className="truncate text-sm font-medium text-text">
                  {m.name}
                </span>
                <span className="text-xs text-text-soft">{m.dosage}</span>
                <Pill tone="info">{m.timing ?? m.frequency ?? "Daily"}</Pill>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
}
