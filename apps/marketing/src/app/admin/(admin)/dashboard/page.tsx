"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  FileLock2,
  MailCheck,
  Megaphone,
  Pill as PillIcon,
  Receipt,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { cn } from "@/portal/lib/utils";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { useAuthStore } from "@/portal/stores/auth";

type Dashboard = {
  generatedAt: string;
  users: {
    byRoleAndStatus: { role: string; status: string; count: number }[];
    pendingApprovals: number;
  };
  doctors: { slmcVerified: number; slmcUnverified: number };
  today: { auditEvents: number; appointments: number; prescriptionsLast7d: number };
  operations: {
    pendingPayouts: number;
    openInsuranceClaims: number;
    openDsarRequests: number;
    newDemoRequests: number;
  };
  marketing: {
    waitlistTotal: number;
    broadcastsSent: number;
    broadcastsLast7d: number;
  };
};

type Tone = "neutral" | "warn" | "danger" | "success" | "info";

const TONE_ICON: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-soft ring-slate-200/70",
  warn: "bg-warn-soft text-amber-700 ring-amber-200/70",
  danger: "bg-danger-soft text-red-700 ring-red-200/70",
  success: "bg-success-soft text-emerald-700 ring-emerald-200/70",
  info: "bg-info-soft text-sky-700 ring-sky-200/70",
};

const ROLE_COLORS: Record<string, string> = {
  patient: "bg-sky-400",
  doctor: "bg-emerald-500",
  hospital_admin: "bg-violet-500",
  hospital_staff: "bg-violet-300",
  laboratory: "bg-teal-500",
  pharmacy: "bg-emerald-400",
  insurance: "bg-amber-500",
  ambulance: "bg-red-500",
  super_admin: "bg-slate-700",
};

function roleColor(role: string) {
  return ROLE_COLORS[role] ?? "bg-slate-300";
}

function StatCard({
  icon,
  label,
  value,
  sub,
  href,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: React.ReactNode;
  href?: string;
  tone?: Tone;
}) {
  const content = (
    <div className="portal-card group relative h-full rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className={cn("grid h-11 w-11 place-items-center rounded-xl ring-1 ring-inset", TONE_ICON[tone])}>
          {icon}
        </div>
        {href ? (
          <ArrowUpRight
            size={16}
            aria-hidden
            className="text-text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-blue-600"
          />
        ) : null}
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
      {sub ? <p className="mt-1.5 text-xs font-medium text-text-soft">{sub}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full no-underline hover:no-underline">
      {content}
    </Link>
  ) : (
    content
  );
}

function QueueRow({
  icon,
  label,
  count,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  href: string;
  tone: Tone;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition-colors no-underline hover:no-underline hover:bg-surface-2/60"
      >
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset", TONE_ICON[tone])}>
          {icon}
        </span>
        <span className="flex-1 text-sm font-semibold text-text">{label}</span>
        {count > 0 ? (
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-500/20">
            {count}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <CheckCircle2 size={13} aria-hidden /> Clear
          </span>
        )}
        <ChevronRight size={15} aria-hidden className="text-text-muted" />
      </Link>
    </li>
  );
}

function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function getTodayFormatted(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const HERO_GLASS = {
  background: "rgba(255, 255, 255, 0.12)",
  borderColor: "rgba(255, 255, 255, 0.18)",
  backdropFilter: "blur(6px)",
} as const;

function HeroPill({
  icon,
  label,
  count,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  href: string;
}) {
  const attention = (count ?? 0) > 0;
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
      style={
        attention
          ? {
              background: "rgba(245, 158, 11, 0.22)",
              borderColor: "rgba(251, 191, 36, 0.4)",
              backdropFilter: "blur(6px)",
            }
          : HERO_GLASS
      }
    >
      {attention ? (
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" aria-hidden />
      ) : (
        <span className="text-sky-200" aria-hidden>{icon}</span>
      )}
      <span>
        {count != null ? `${count} ` : ""}{label}
      </span>
    </Link>
  );
}

/** Oceanic gradient hero — admin counterpart of the patient DashboardHero. */
function AdminHero({
  data,
  isFetching,
  onRefresh,
}: {
  data?: Dashboard;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const { user } = useAuthStore();
  const hour = new Date().getHours();
  const firstName = (user?.name ?? "Admin").split(" ")[0];
  const attentionTotal = data
    ? data.users.pendingApprovals +
      data.operations.pendingPayouts +
      data.operations.openDsarRequests +
      data.operations.newDemoRequests
    : 0;

  return (
    <header
      className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl md:p-7"
      style={{
        background:
          "linear-gradient(135deg, #0B4A6F 0%, #0369A1 45%, #0E7490 75%, #14919B 100%)",
        boxShadow:
          "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
      }}
    >
      {/* Ambient glowing orbs */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)" }}
        aria-hidden
      />
      {/* Clinical cross watermark */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      <div className="relative z-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-6">
          {/* Left: greeting + status pills */}
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <ShieldCheck size={15} className="text-sky-200" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
                Admin · {getTodayFormatted()}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              {greetingForHour(hour)}, {firstName}
            </h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-white/80">
              {data
                ? attentionTotal > 0
                  ? `${attentionTotal} item${attentionTotal === 1 ? "" : "s"} across the operations queues need your attention.`
                  : "All operational queues are clear — the platform is running smoothly."
                : "Loading the latest platform metrics…"}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <HeroPill
                icon={<UserCheck size={13} />}
                label="approvals pending"
                count={data?.users.pendingApprovals}
                href="/admin/approvals"
              />
              <HeroPill
                icon={<Wallet size={13} />}
                label="payouts pending"
                count={data?.operations.pendingPayouts}
                href="/admin/payouts?status=pending"
              />
              <HeroPill
                icon={<FileLock2 size={13} />}
                label="DSAR open"
                count={data?.operations.openDsarRequests}
                href="/admin/dsar"
              />
              <HeroPill
                icon={<Megaphone size={13} />}
                label="demo requests"
                count={data?.operations.newDemoRequests}
                href="/admin/demo-requests?status=new"
              />
            </div>
          </div>

          {/* Right: ops pulse card + CTA */}
          <div className="flex w-full shrink-0 flex-col items-stretch gap-3 md:w-auto md:items-end">
            <div
              className="flex min-w-[13.5rem] items-center gap-4 rounded-2xl border px-4 py-3.5"
              style={{ ...HERO_GLASS, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)" }}
            >
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-md"
                style={{
                  background: "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
                  boxShadow: "0 4px 14px rgba(14, 165, 233, 0.4)",
                }}
              >
                <Activity size={22} strokeWidth={2.3} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-200">
                  Activity today
                </p>
                <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-white">
                  {data ? data.today.auditEvents.toLocaleString() : "—"}
                </p>
                <p className="mt-0.5 text-[11.5px] font-medium text-sky-100/80">
                  {data
                    ? `${data.today.appointments} appts · ${data.today.prescriptionsLast7d} rx/7d`
                    : "Fetching counters"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-white/85 transition-colors hover:text-white"
              >
                <RefreshCw size={12} className={cn(isFetching && "animate-spin")} />
                {isFetching ? "Refreshing…" : "Refresh"}
              </button>
              <Link
                href="/admin/approvals"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#0369A1] shadow-md transition-transform hover:scale-[1.02]"
              >
                <UserCheck size={14} aria-hidden />
                Review approvals
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: adminQk.dashboard(),
    queryFn: () => adminApi<Dashboard>("/admin/dashboard"),
    refetchInterval: 60_000,
  });

  const totalUsers =
    data?.users.byRoleAndStatus.reduce((acc, r) => acc + r.count, 0) ?? 0;

  const roleCounts = new Map<string, number>();
  for (const r of data?.users.byRoleAndStatus ?? []) {
    roleCounts.set(r.role, (roleCounts.get(r.role) ?? 0) + r.count);
  }
  const roles = [...roleCounts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);

  const queue: { icon: React.ReactNode; label: string; count: number; href: string; tone: Tone }[] = data
    ? [
        {
          icon: <UserCheck size={16} />,
          label: "Pending approvals",
          count: data.users.pendingApprovals,
          href: "/admin/approvals",
          tone: "warn",
        },
        {
          icon: <Wallet size={16} />,
          label: "Pending payouts",
          count: data.operations.pendingPayouts,
          href: "/admin/payouts?status=pending",
          tone: "warn",
        },
        {
          icon: <Receipt size={16} />,
          label: "Open insurance claims",
          count: data.operations.openInsuranceClaims,
          href: "/admin/insurance-claims",
          tone: "info",
        },
        {
          icon: <FileLock2 size={16} />,
          label: "Open DSAR requests",
          count: data.operations.openDsarRequests,
          href: "/admin/dsar",
          tone: "warn",
        },
        {
          icon: <Megaphone size={16} />,
          label: "New demo requests",
          count: data.operations.newDemoRequests,
          href: "/admin/demo-requests?status=new",
          tone: "info",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      <AdminHero
        data={data}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="admin-shimmer h-[132px] rounded-2xl border border-border"
            />
          ))}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<UserCheck size={20} />}
              label="Pending approvals"
              value={data.users.pendingApprovals}
              sub={data.users.pendingApprovals > 0 ? "Awaiting review" : "Queue is clear"}
              tone={data.users.pendingApprovals > 0 ? "warn" : "success"}
              href="/admin/approvals"
            />
            <StatCard
              icon={<Users size={20} />}
              label="Total users"
              value={totalUsers}
              sub={`Across ${roles.length} roles`}
              href="/admin/users"
            />
            <StatCard
              icon={<Stethoscope size={20} />}
              label="Doctors verified"
              value={data.doctors.slmcVerified}
              sub={
                data.doctors.slmcUnverified > 0
                  ? `${data.doctors.slmcUnverified} awaiting SLMC`
                  : "All SLMC verified"
              }
              tone={data.doctors.slmcUnverified > 0 ? "warn" : "success"}
              href="/admin/doctors"
            />
            <StatCard
              icon={<Megaphone size={20} />}
              label="Demo requests"
              value={data.operations.newDemoRequests}
              sub={`${data.marketing.waitlistTotal.toLocaleString()} on waitlist`}
              tone={data.operations.newDemoRequests > 0 ? "warn" : "neutral"}
              href="/admin/demo-requests?status=new"
            />
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Left: attention queue + today */}
            <div className="flex flex-col gap-5 lg:col-span-2">
              <Card padding={false} className="overflow-hidden">
                <div className="px-5 pt-5">
                  <CardHeader
                    title="Needs attention"
                    subtitle="Operational queues that need admin action"
                    icon={<Activity size={16} className="text-blue-600" />}
                  />
                </div>
                <ul className="divide-y divide-border/60 pb-2">
                  {queue.map((item) => (
                    <QueueRow key={item.label} {...item} />
                  ))}
                </ul>
              </Card>

              <Card padding={false} className="overflow-hidden">
                <div className="px-5 pt-5">
                  <CardHeader
                    title="Today's activity"
                    subtitle="Live counters, refreshed every 60s"
                    icon={<Activity size={16} className="text-blue-600" />}
                  />
                </div>
                <div className="grid grid-cols-3 divide-x divide-border/60">
                  {[
                    {
                      icon: <ScrollText size={16} />,
                      label: "Audit events",
                      value: data.today.auditEvents,
                      href: "/admin/audit",
                    },
                    {
                      icon: <Stethoscope size={16} />,
                      label: "Appointments",
                      value: data.today.appointments,
                    },
                    {
                      icon: <PillIcon size={16} />,
                      label: "Rx · last 7 days",
                      value: data.today.prescriptionsLast7d,
                    },
                  ].map((s) => {
                    const inner = (
                      <div className="group flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2/50">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-soft ring-1 ring-inset ring-border">
                          {s.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-2xl font-extrabold tabular-nums leading-none">
                            {s.value.toLocaleString()}
                          </p>
                          <p className="mt-1.5 truncate text-[11px] font-bold uppercase tracking-wider text-text-muted">
                            {s.label}
                          </p>
                        </div>
                      </div>
                    );
                    return s.href ? (
                      <Link key={s.label} href={s.href} className="no-underline hover:no-underline">
                        {inner}
                      </Link>
                    ) : (
                      <div key={s.label}>{inner}</div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Right rail */}
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader
                  title="Users by role"
                  subtitle={`${totalUsers.toLocaleString()} total`}
                  icon={<Users size={16} className="text-blue-600" />}
                  className="mb-4"
                />
                {totalUsers > 0 ? (
                  <>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
                      {roles.map((r) => (
                        <div
                          key={r.role}
                          className={cn("h-full first:rounded-l-full last:rounded-r-full", roleColor(r.role))}
                          style={{ width: `${(r.count / totalUsers) * 100}%` }}
                          title={`${r.role.replace(/_/g, " ")} · ${r.count}`}
                        />
                      ))}
                    </div>
                    <ul className="mt-4 flex flex-col gap-2.5">
                      {roles.slice(0, 6).map((r) => (
                        <li key={r.role} className="flex items-center gap-2.5 text-sm">
                          <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", roleColor(r.role))} />
                          <span className="flex-1 capitalize text-text-soft">
                            {r.role.replace(/_/g, " ")}
                          </span>
                          <span className="font-bold tabular-nums text-text">{r.count}</span>
                          <span className="w-10 text-right text-[11px] font-semibold text-text-muted tabular-nums">
                            {Math.round((r.count / totalUsers) * 100)}%
                          </span>
                        </li>
                      ))}
                      {roles.length > 6 ? (
                        <li className="text-[11px] font-medium text-text-muted">
                          +{roles.length - 6} more roles
                        </li>
                      ) : null}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-text-soft">No users yet.</p>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Marketing"
                  icon={<Megaphone size={16} className="text-blue-600" />}
                  className="mb-4"
                />
                <div className="flex flex-col gap-3">
                  <Link
                    href="/admin/waitlist"
                    className="group flex items-center justify-between rounded-xl border border-border bg-surface-2/50 px-3.5 py-3 no-underline transition-colors hover:border-border-strong hover:no-underline"
                  >
                    <div className="flex items-center gap-2.5">
                      <MailCheck size={15} className="text-blue-600" />
                      <span className="text-sm font-semibold text-text">Waitlist signups</span>
                    </div>
                    <span className="text-lg font-extrabold tabular-nums">
                      {data.marketing.waitlistTotal.toLocaleString()}
                    </span>
                  </Link>
                  <div className="flex items-center justify-between px-1 text-sm">
                    <span className="text-text-soft">Broadcasts sent</span>
                    <span className="font-bold tabular-nums">{data.marketing.broadcastsSent.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between px-1 text-sm">
                    <span className="text-text-soft">Broadcasts · 7 days</span>
                    <span className="font-bold tabular-nums">{data.marketing.broadcastsLast7d.toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Quick actions"
                  className="mb-4"
                />
                <div className="flex flex-col gap-2">
                  <Link href="/admin/approvals" className="portal-btn portal-btn-primary portal-btn-md no-underline hover:no-underline">
                    Review approvals
                  </Link>
                  <Link href="/admin/notifications" className="portal-btn portal-btn-secondary portal-btn-md no-underline hover:no-underline">
                    Send broadcast
                  </Link>
                  <Link href="/admin/audit" className="portal-btn portal-btn-secondary portal-btn-md no-underline hover:no-underline">
                    Open audit log
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
