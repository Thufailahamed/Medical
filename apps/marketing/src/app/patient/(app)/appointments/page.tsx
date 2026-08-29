"use client";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { useAppointments } from "@/patient/hooks";
import { formatDayLabel, formatTime, humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

export default function AppointmentsPage() {
  const query = useAppointments();
  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Your calendar"
        title="Appointments"
        description="Upcoming and recent visits your care team has on file."
      />

      <Card>
        <QueryBoundary
          query={query as any}
          loadingCount={4}
          emptyTitle="No appointments"
          emptyDescription="Once a doctor schedules a visit with you, it will land here."
        >
          {(data) => {
            const sorted = [...(data.appointments ?? [])].sort((a, b) =>
              (b.date + b.time).localeCompare(a.date + a.time)
            );
            if (sorted.length === 0) {
              return (
                <p className="text-sm text-text-soft">No appointments</p>
              );
            }
            const today = new Date().toISOString().slice(0, 10);
            const upcoming = sorted.filter((a) => a.date >= today);
            const past = sorted.filter((a) => a.date < today);

            return (
              <div className="flex flex-col gap-6">
                {upcoming.length > 0 ? (
                  <section>
                    <p className="t-label">Upcoming</p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {upcoming.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-3 rounded-inner bg-surface-2 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text">
                              {a.doctorName ?? "Doctor"}{" "}
                              {a.doctorSpecialization ? (
                                <span className="text-text-muted">
                                  · {a.doctorSpecialization}
                                </span>
                              ) : null}
                            </p>
                            <p className="t-micro">
                              {formatDayLabel(a.date)} · {formatTime(a.time)}{" "}
                              {a.hospitalName ? `· ${a.hospitalName}` : ""}
                            </p>
                          </div>
                          <Pill tone={a.mode === "video" ? "brand" : "neutral"}>
                            {humanize(a.mode)}
                          </Pill>
                          <Pill tone={statusTone(a.status)}>
                            {humanize(a.status)}
                          </Pill>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {past.length > 0 ? (
                  <section>
                    <p className="t-label">Past visits</p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {past.slice(0, 6).map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-3 rounded-inner px-4 py-2 text-sm text-text-soft"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {a.doctorName ?? "Doctor"} ·{" "}
                            {formatDayLabel(a.date)}
                          </span>
                          <Pill tone="info">{humanize(a.status)}</Pill>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}

function statusTone(s: string): "success" | "warn" | "danger" | "neutral" | "info" {
  if (s === "confirmed" || s === "completed") return "success";
  if (s === "scheduled") return "info";
  if (s === "cancelled" || s === "no_show") return "danger";
  if (s === "in_progress") return "warn";
  return "neutral";
}
