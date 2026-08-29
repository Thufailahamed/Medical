"use client";

import Link from "next/link";
import {
  Calendar,
  Pill,
  Stethoscope,
  FileText,
  Activity,
  Heart,
  ChevronRight,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useTimeline } from "@/patient/hooks";
import { formatDayLabel, humanize } from "@/patient/lib/format";

const KIND_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  record: FileText,
  vital: Heart,
  symptom: Activity,
  medicine_start: Pill,
  medicine_stop: Pill,
  appointment: Stethoscope,
  note: FileText,
};

const KIND_TONES: Record<string, "brand" | "success" | "warn" | "info"> = {
  record: "info",
  vital: "brand",
  symptom: "warn",
  medicine_start: "success",
  medicine_stop: "neutral" as "info",
  appointment: "brand",
  note: "info",
};

export default function TimelinePage() {
  const query = useTimeline({ limit: 100 });
  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Your story"
        title="Health timeline"
        description="Every event in one place — appointments, prescriptions, vitals, notes. Sorted newest first."
      />

      <Card>
        <QueryBoundary
          query={query}
          loadingCount={6}
          emptyTitle="Nothing to show yet"
          emptyDescription="As you add records, take medicines, and book visits, they'll appear here."
        >
          {(data) => {
            const events = (data as { events?: Array<{ id: string; kind: string; date: string; title: string; subtitle: string | null; meta: Record<string, unknown> | null }> })
              ?.events ?? [];
            if (events.length === 0) {
              return (
                <p className="text-sm text-text-soft">No events yet.</p>
              );
            }
            return (
              <ol className="flex flex-col gap-3">
                {events.map((e, i) => {
                  const Icon = KIND_ICONS[e.kind] ?? FileText;
                  const tone = KIND_TONES[e.kind] ?? "info";
                  return (
                    <li key={e.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="grid h-9 w-9 place-items-center rounded-pill"
                          style={{
                            background:
                              "linear-gradient(145deg, var(--color-brand-soft) 0%, rgba(124,108,255,0.18) 100%)",
                            color: "var(--color-brand-strong)",
                          }}
                          aria-hidden
                        >
                          <Icon size={15} />
                        </div>
                        {i < events.length - 1 ? (
                          <div
                            aria-hidden
                            className="mt-1 h-full w-px bg-surface-3"
                            style={{ minHeight: 24 }}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 rounded-inner bg-surface-2 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-text">
                            {e.title}
                          </p>
                          <StatusPill tone={tone}>{humanize(e.kind)}</StatusPill>
                        </div>
                        {e.subtitle ? (
                          <p className="mt-1 text-xs text-text-soft">
                            {e.subtitle}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-text-muted">
                          {formatDayLabel(e.date)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}
