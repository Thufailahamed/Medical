"use client";

import { Activity } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useTimeline } from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

export function RecentActivity({ className }: { className?: string }) {
  const query = useTimeline({ limit: 8 });
  return (
    <Card accent="green" className={cn("anim-rise", className)}>
      <CardHeader
        title="Recent activity"
        caption="Your care timeline"
        icon={<Activity size={15} />}
      />
      <QueryBoundary
        query={query}
        emptyTitle="No recent activity"
        emptyDescription="Visits, prescriptions and readings you've logged will appear here."
        className="mt-4"
      >
        {(data) => (
          <ol className="mt-4 flex flex-col gap-3">
            {data.events.map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <span
                  className="mt-1.5 block h-2 w-2 rounded-full bg-brand"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {e.title}
                  </p>
                  {e.subtitle ? (
                    <p className="truncate text-xs text-text-soft">
                      {e.subtitle}
                    </p>
                  ) : null}
                </div>
                <span className="t-micro shrink-0">
                  {formatRelative(e.date)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </QueryBoundary>
    </Card>
  );
}
