"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Users,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  DoorOpen,
} from "lucide-react";
import Link from "next/link";

import { api, qk } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Button } from "@/portal/components/ui/Button";
import { useAuthStore } from "@/portal/stores/auth";
import { useT } from "@/portal/i18n";
import { formatLkr, formatTime, relativeTime } from "@/portal/lib/format";

interface DashboardResponse {
  doctor: {
    id: string;
    specialization: string;
    hospitalId?: string | null;
  };
  stats: { todayAppointments: number; totalPatients: number };
  todaysAppointments: Array<{
    id: string;
    patientId: string;
    time: string;
    status: string;
    reason?: string | null;
    queueNumber?: number | null;
  }>;
}

interface ConversationsResponse {
  conversations: Array<{
    id: string;
    patientId: string;
    patient: { id: string; userId: string; name: string; photo: string | null };
    lastMessageAt: string;
    lastMessagePreview: string | null;
    doctorUnread: number;
  }>;
  totalUnread: number;
}

interface WalkInsResponse {
  walkIns: Array<{
    id: string;
    patientId: string;
    arrivedAt: string;
    reason: string | null;
    priority: string;
    status: string;
  }>;
}

interface EarningsSummary {
  thisWeek: number;
  thisMonth: number;
  total: number;
  pendingPayout: number;
  events: Array<{ amount: number; occurredAt: string }>;
}

export default function DashboardPage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api<DashboardResponse>("/doctor/dashboard"),
  });

  const { data: msgs } = useQuery({
    queryKey: qk.messages({ limit: 5 }),
    queryFn: () => api<ConversationsResponse>("/doctor-messages/conversations?limit=5"),
  });

  const { data: walkins } = useQuery({
    queryKey: qk.walkins({ status: "waiting" }),
    queryFn: () =>
      api<WalkInsResponse>(
        "/walk-ins?status=waiting&limit=10"
      ),
  });

  const { data: earnings } = useQuery({
    queryKey: qk.earningsSummary,
    queryFn: () => api<EarningsSummary>("/doctor-earnings/summary"),
  });

  const today = dash?.todaysAppointments ?? [];
  const waiting = walkins?.walkIns ?? [];
  const recent = (msgs?.conversations ?? []).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text">
            {t("dashboard.title", { name: user?.name?.split(" ")[0] ?? "Doctor" })}
          </h1>
          <p className="text-sm text-text-soft mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <Pill tone="brand">{dash?.doctor?.specialization ?? "Doctor"}</Pill>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Calendar size={16} />}
          label={t("dashboard.statAppointments")}
          value={dashLoading ? "…" : String(dash?.stats.todayAppointments ?? 0)}
          href="/portal/schedule"
          tone="brand"
        />
        <StatCard
          icon={<DoorOpen size={16} />}
          label={t("dashboard.statWalkIns")}
          value={String(waiting.length)}
          href="/portal/walk-ins"
          tone="violet"
        />
        <StatCard
          icon={<MessageSquare size={16} />}
          label={t("dashboard.statUnread")}
          value={String(msgs?.totalUnread ?? 0)}
          href="/portal/messages"
          tone={msgs?.totalUnread ? "warn" : "success"}
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label={t("dashboard.statEarnings")}
          value={earnings ? formatLkr(earnings.thisWeek) : "…"}
          href="/portal/earnings"
          tone="success"
        />
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's schedule */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("dashboard.sectionToday")}
            right={
              <Link href="/portal/schedule">
                <Button size="sm" variant="ghost" rightIcon={<ArrowRight size={14} />}>
                  {t("dashboard.openSchedule")}
                </Button>
              </Link>
            }
          />
          {dashLoading ? (
            <div className="flex flex-col gap-2 mt-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : today.length === 0 ? (
            <Empty title={t("dashboard.emptyToday")} className="mt-3" />
          ) : (
            <ul className="flex flex-col divide-y divide-border mt-3">
              {today.map((a) => (
                <li key={a.id} className="py-2.5 flex items-center gap-3">
                  <div className="font-mono text-sm tabular-nums text-text w-16">
                    {formatTime(`1970-01-01T${a.time}`)}
                  </div>
                  <Pill
                    tone={
                      a.status === "completed"
                        ? "success"
                        : a.status === "in_progress"
                          ? "brand"
                          : "neutral"
                    }
                  >
                    {a.status.replace("_", " ")}
                  </Pill>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text truncate">
                      {a.reason ?? "Consultation"}
                    </div>
                    {a.queueNumber != null ? (
                      <div className="text-xs text-text-muted">Queue #{a.queueNumber}</div>
                    ) : null}
                  </div>
                  <Link
                    href={`/patients/${a.patientId}`}
                    className="text-xs text-brand hover:underline shrink-0"
                  >
                    Open chart
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Inbox preview */}
        <Card>
          <CardHeader
            title={t("dashboard.sectionInbox")}
            right={
              <Link href="/portal/messages">
                <Button size="sm" variant="ghost" rightIcon={<ArrowRight size={14} />}>
                  {t("dashboard.openInbox")}
                </Button>
              </Link>
            }
          />
          {recent.length === 0 ? (
            <Empty title={t("dashboard.emptyInbox")} className="mt-3" />
          ) : (
            <ul className="flex flex-col gap-2 mt-3">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.id}`}
                    className="flex items-center gap-2.5 p-2 rounded-md hover:bg-surface-2"
                  >
                    <Avatar name={c.patient.name} src={c.patient.photo} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-text truncate">
                          {c.patient.name}
                        </span>
                        <span className="text-[10px] text-text-muted shrink-0">
                          {relativeTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="text-xs text-text-soft truncate">
                        {c.lastMessagePreview ?? "(no preview)"}
                      </div>
                    </div>
                    {c.doctorUnread > 0 ? (
                      <Pill tone="brand">{c.doctorUnread}</Pill>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Walk-in queue */}
      <Card>
        <CardHeader
          title={t("dashboard.sectionQueue")}
          right={
            <Link href="/portal/walk-ins">
              <Button size="sm" variant="ghost" rightIcon={<ArrowRight size={14} />}>
                {t("dashboard.openQueue")}
              </Button>
            </Link>
          }
        />
        {waiting.length === 0 ? (
          <Empty title={t("dashboard.emptyQueue")} className="mt-3" />
        ) : (
          <ul className="flex flex-col divide-y divide-border mt-3">
            {waiting.map((w) => (
              <li key={w.id} className="py-2.5 flex items-center gap-3">
                <Pill tone={w.priority === "urgent" ? "danger" : "neutral"}>
                  {w.priority}
                </Pill>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text truncate">{w.reason ?? "Walk-in"}</div>
                  <div className="text-xs text-text-muted">
                    Arrived {relativeTime(w.arrivedAt)}
                  </div>
                </div>
                <Link
                  href={`/patients/${w.patientId}`}
                  className="text-xs text-brand hover:underline"
                >
                  Open chart
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  tone: "brand" | "success" | "warn" | "violet";
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div
            className={
              tone === "brand"
                ? "h-10 w-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center"
                : tone === "success"
                  ? "h-10 w-10 rounded-lg bg-success-soft text-success flex items-center justify-center"
                  : tone === "warn"
                    ? "h-10 w-10 rounded-lg bg-warn-soft text-amber-700 flex items-center justify-center"
                    : "h-10 w-10 rounded-lg bg-violet-soft text-violet flex items-center justify-center"
            }
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-text-soft">{label}</div>
            <div className="text-xl font-semibold text-text leading-tight tabular-nums">
              {value}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}