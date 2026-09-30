"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileLock2,
  HeartPulse,
  MailCheck,
  Megaphone,
  Pill as PillIcon,
  Receipt,
  RefreshCw,
  ScrollText,
  Send,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
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

type Tone = "amber" | "sky" | "violet" | "rose" | "emerald";

const TONE_TILE: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
  emerald: "bg-emerald-50 text-emerald-600",
};

const TONE_RAIL: Record<Tone, string> = {
  amber: "bg-amber-400",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
};

const ROLE_COLORS: Record<string, string> = {
  patient: "bg-sky-500",
  doctor: "bg-emerald-500",
  hospital_admin: "bg-violet-500",
  hospital_staff: "bg-violet-300",
  laboratory: "bg-teal-500",
  pharmacy: "bg-lime-500",
  insurance: "bg-amber-500",
  ambulance: "bg-red-500",
  super_admin: "bg-slate-700",
};

function roleColor(role: string) {
  return ROLE_COLORS[role] ?? "bg-slate-300";
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

const QUICK_TOOLS = [
  { href: "/admin/approvals", label: "Approvals", hint: "Review sign-ups", icon: UserCheck, tone: "from-amber-500 to-orange-500", glow: "shadow-amber-500/30" },
  { href: "/admin/users", label: "Users", hint: "Directory", icon: Users, tone: "from-sky-500 to-blue-600", glow: "shadow-sky-500/30" },
  { href: "/admin/doctors", label: "Doctors", hint: "SLMC checks", icon: Stethoscope, tone: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/30" },
  { href: "/admin/hospitals", label: "Tenants", hint: "Hospitals", icon: Building2, tone: "from-violet-500 to-purple-600", glow: "shadow-violet-500/30" },
  { href: "/admin/notifications", label: "Broadcast", hint: "Notify users", icon: Send, tone: "from-rose-500 to-pink-600", glow: "shadow-rose-500/30" },
  { href: "/admin/audit", label: "Audit log", hint: "Every action", icon: ScrollText, tone: "from-slate-600 to-slate-800", glow: "shadow-slate-500/30" },
] as const;

/** Glass tile on the hero showing today's audit volume. */
function PulseCard({ data }: { data?: Dashboard }) {
  return (
    <div className="flex min-w-[13.5rem] items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-500/30">
        <Activity size={20} strokeWidth={2.3} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sky-300">
          Activity today
        </span>
        <span className="mt-0.5 block text-2xl font-semibold leading-none tracking-[-0.02em] text-white tabular-nums">
          {data ? data.today.auditEvents.toLocaleString() : "—"}
        </span>
        <span className="mt-1 block text-[11px] text-white/55">
          {data ? `${data.today.appointments} appts · ${data.today.prescriptionsLast7d} rx / 7d` : "Fetching counters"}
        </span>
      </span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: adminQk.dashboard(),
    queryFn: () => adminApi<Dashboard>("/admin/dashboard"),
    refetchInterval: 60_000,
  });

  const firstName = (user?.name ?? "Admin").split(" ")[0];
  const hour = new Date().getHours();

  const totalUsers = data?.users.byRoleAndStatus.reduce((acc, r) => acc + r.count, 0) ?? 0;
  const activeUsers =
    data?.users.byRoleAndStatus.filter((r) => r.status === "active").reduce((acc, r) => acc + r.count, 0) ?? 0;

  const roleCounts = new Map<string, number>();
  for (const r of data?.users.byRoleAndStatus ?? []) {
    roleCounts.set(r.role, (roleCounts.get(r.role) ?? 0) + r.count);
  }
  const roles = [...roleCounts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);

  const doctorsTotal = data ? data.doctors.slmcVerified + data.doctors.slmcUnverified : 0;
  const verifiedPct = doctorsTotal > 0 ? Math.round(((data?.doctors.slmcVerified ?? 0) / doctorsTotal) * 100) : 0;

  const queue: { icon: React.ReactNode; label: string; hint: string; count: number; href: string; tone: Tone }[] = data
    ? [
        { icon: <UserCheck size={16} />, label: "Pending approvals", hint: "New providers waiting for review", count: data.users.pendingApprovals, href: "/admin/approvals", tone: "amber" },
        { icon: <Wallet size={16} />, label: "Pending payouts", hint: "Doctor payout requests to settle", count: data.operations.pendingPayouts, href: "/admin/payouts?status=pending", tone: "emerald" },
        { icon: <Receipt size={16} />, label: "Open insurance claims", hint: "Claims awaiting adjudication", count: data.operations.openInsuranceClaims, href: "/admin/insurance-claims", tone: "sky" },
        { icon: <FileLock2 size={16} />, label: "Open DSAR requests", hint: "Data-subject access requests", count: data.operations.openDsarRequests, href: "/admin/dsar", tone: "rose" },
        { icon: <Megaphone size={16} />, label: "New demo requests", hint: "Sales leads from the website", count: data.operations.newDemoRequests, href: "/admin/demo-requests?status=new", tone: "violet" },
      ]
    : [];
  const attentionTotal = queue.reduce((acc, q) => acc + q.count, 0);
  const openQueues = queue.filter((q) => q.count > 0);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<ShieldCheck size={13} aria-hidden />}
          kicker="Platform admin"
          kickerMeta={getTodayFormatted()}
          title={
            <>
              {greetingForHour(hour)},{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                {firstName}
              </span>
            </>
          }
          description={
            data
              ? attentionTotal > 0
                ? `${attentionTotal} item${attentionTotal === 1 ? "" : "s"} across ${openQueues.length} queue${openQueues.length === 1 ? "" : "s"} need your attention.`
                : "All operational queues are clear — the platform is running smoothly."
              : "Loading the latest platform metrics…"
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Systems operational
              </span>
              {openQueues.map((q) => (
                <Link
                  key={q.label}
                  href={q.href}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
                >
                  {q.icon}
                  {q.count} {q.label.toLowerCase()}
                </Link>
              ))}
            </>
          }
          aside={<PulseCard data={data} />}
          actions={
            <>
              <button type="button" onClick={() => refetch()} className={HERO_GHOST}>
                <RefreshCw size={15} className={cn(isFetching && "animate-spin")} aria-hidden />
                {isFetching ? "Refreshing…" : "Refresh"}
              </button>
              <Link href="/admin/approvals" className={HERO_PRIMARY}>
                <UserCheck size={15} className="text-sky-600" aria-hidden />
                Review approvals
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            href="/admin/approvals"
            label="Pending approvals"
            icon={<UserCheck size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={isLoading || !data ? "…" : String(data.users.pendingApprovals)}
            sub={data && data.users.pendingApprovals > 0 ? "Awaiting review" : "Queue is clear"}
            badge={data && data.users.pendingApprovals > 0 ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            pulse={!!data && data.users.pendingApprovals > 0}
          />
          <StatTile
            href="/admin/users"
            label="Total users"
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading || !data ? "…" : totalUsers.toLocaleString()}
            sub={`${activeUsers.toLocaleString()} active · ${roles.length} roles`}
            progress={totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : null}
          />
          <StatTile
            href="/admin/doctors"
            label="Doctors verified"
            icon={<BadgeCheck size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={isLoading || !data ? "…" : String(data.doctors.slmcVerified)}
            unit={doctorsTotal > 0 ? `/ ${doctorsTotal}` : undefined}
            sub={data && data.doctors.slmcUnverified > 0 ? `${data.doctors.slmcUnverified} awaiting SLMC` : "All SLMC verified"}
            progress={doctorsTotal > 0 ? verifiedPct : null}
          />
          <StatTile
            href="/admin/demo-requests?status=new"
            label="Demo requests"
            icon={<Megaphone size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={isLoading || !data ? "…" : String(data.operations.newDemoRequests)}
            sub={data ? `${data.marketing.waitlistTotal.toLocaleString()} on waitlist` : "Sales pipeline"}
            badge={data && data.operations.newDemoRequests > 0 ? { text: "New", tone: "bg-violet-50 text-violet-700" } : undefined}
          />
        </HeroOverlap>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* Needs attention */}
          <section className={PANEL} aria-labelledby="adm-queue">
            <PanelHeader
              id="adm-queue"
              icon={<Activity size={16} />}
              tone="bg-amber-50 text-amber-600"
              title="Needs attention"
              caption={
                !data
                  ? "Loading queues…"
                  : attentionTotal > 0
                    ? `${attentionTotal} open item${attentionTotal === 1 ? "" : "s"} · ${openQueues.length} of ${queue.length} queues`
                    : "Every operational queue is clear"
              }
            />
            {!data ? (
              <div className="mt-5 space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {queue.map((q) => {
                  const open = q.count > 0;
                  return (
                    <li key={q.label}>
                      <Link
                        href={q.href}
                        className={cn(
                          "group relative flex items-center gap-3.5 rounded-xl p-3.5 transition-all hover:-translate-y-px",
                          open
                            ? "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                            : "bg-slate-50/70 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]",
                        )}
                      >
                        <span
                          className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", open ? TONE_RAIL[q.tone] : "bg-transparent")}
                          aria-hidden
                        />
                        <span className={cn("ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", open ? TONE_TILE[q.tone] : "bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]")}>
                          {q.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                            {q.label}
                          </span>
                          <span className="block truncate text-xs text-slate-400">{q.hint}</span>
                        </span>
                        {open ? (
                          <span className="grid h-6 min-w-[28px] place-items-center rounded-full bg-slate-900 px-2 text-[11px] font-bold tabular-nums text-white">
                            {q.count}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 size={12} aria-hidden />
                            Clear
                          </span>
                        )}
                        <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Today's activity */}
          <section className={PANEL} aria-labelledby="adm-today">
            <PanelHeader
              id="adm-today"
              icon={<HeartPulse size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Today's activity"
              caption="Live counters · refreshed every 60 seconds"
              href="/admin/audit"
              linkLabel="Audit log"
            />
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: <ScrollText size={17} />, label: "Audit events", value: data?.today.auditEvents, tone: "bg-sky-50 text-sky-600", href: "/admin/audit" },
                { icon: <Stethoscope size={17} />, label: "Appointments today", value: data?.today.appointments, tone: "bg-emerald-50 text-emerald-600" },
                { icon: <PillIcon size={17} />, label: "Prescriptions · 7 days", value: data?.today.prescriptionsLast7d, tone: "bg-violet-50 text-violet-600" },
              ].map((m) => {
                const inner = (
                  <>
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", m.tone)}>{m.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-[24px] font-semibold leading-none tracking-[-0.03em] text-slate-900 tabular-nums">
                        {m.value != null ? m.value.toLocaleString() : "—"}
                      </span>
                      <span className="mt-1.5 block truncate text-xs text-slate-400">{m.label}</span>
                    </span>
                  </>
                );
                const cls = "flex items-center gap-3.5 rounded-xl bg-slate-50 p-4 transition-all";
                return m.href ? (
                  <Link key={m.label} href={m.href} className={cn(cls, "hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_24px_-10px_rgba(15,23,42,0.2),inset_0_0_0_1px_rgba(15,23,42,0.07)]")}>
                    {inner}
                  </Link>
                ) : (
                  <div key={m.label} className={cls}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Platform overview">
          {/* Quick tools */}
          <section className={PANEL} aria-labelledby="adm-tools">
            <div className="flex items-center justify-between gap-3">
              <h2 id="adm-tools" className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900">
                Quick tools
              </h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">One click</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {QUICK_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group flex flex-col items-center gap-2 rounded-xl px-1.5 py-3 text-center transition-all hover:-translate-y-0.5 hover:bg-slate-50"
                  >
                    <span
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105",
                        tool.tone,
                        tool.glow,
                      )}
                    >
                      <Icon size={19} aria-hidden />
                    </span>
                    <span className="w-full min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-slate-900">{tool.label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{tool.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Users by role */}
          <section className={PANEL} aria-labelledby="adm-roles">
            <PanelHeader
              id="adm-roles"
              icon={<Users size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Users by role"
              caption={`${totalUsers.toLocaleString()} total`}
              href="/admin/users"
              linkLabel="Directory"
            />
            {!data ? (
              <div className="mt-5 h-32 animate-pulse rounded-xl bg-slate-100" />
            ) : totalUsers === 0 ? (
              <EmptyBlock icon={<Users size={19} />} title="No users yet" body="Accounts appear here as people sign up." />
            ) : (
              <>
                <div className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                  {roles.map((r) => (
                    <span
                      key={r.role}
                      className={cn("h-full first:rounded-l-full last:rounded-r-full", roleColor(r.role))}
                      style={{ width: `${(r.count / totalUsers) * 100}%` }}
                      title={`${r.role.replace(/_/g, " ")} · ${r.count}`}
                    />
                  ))}
                </div>
                <ul className="mt-4 flex flex-col gap-0.5">
                  {roles.slice(0, 7).map((r) => (
                    <li key={r.role} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-slate-50">
                      <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", roleColor(r.role))} />
                      <span className="min-w-0 flex-1 truncate capitalize text-slate-700">{r.role.replace(/_/g, " ")}</span>
                      <span className="text-[11px] tabular-nums text-slate-400">{Math.round((r.count / totalUsers) * 100)}%</span>
                      <span className="min-w-[28px] rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-700">
                        {r.count}
                      </span>
                    </li>
                  ))}
                  {roles.length > 7 ? (
                    <li className="px-0 pt-1 text-[11px] font-medium text-slate-400">+{roles.length - 7} more roles</li>
                  ) : null}
                </ul>
              </>
            )}
          </section>

          {/* Marketing */}
          <Link
            href="/admin/waitlist"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white transition-all hover:-translate-y-0.5"
            style={{
              background:
                "radial-gradient(420px 200px at 100% 0%, rgba(244,114,182,0.30), transparent 60%), radial-gradient(300px 160px at 0% 100%, rgba(129,140,248,0.25), transparent 60%), linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -18px rgba(49,46,129,0.6)",
            }}
          >
            <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden />
            <span className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 rounded-full border border-white/10" aria-hidden />
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-pink-200 ring-1 ring-inset ring-white/15 backdrop-blur">
              <MailCheck size={21} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-pink-200/80">
                Marketing
              </span>
              <span className="mt-1 block text-lg font-semibold tracking-[-0.01em]">
                {data ? data.marketing.waitlistTotal.toLocaleString() : "—"} on the waitlist
              </span>
              <span className="block text-xs text-white/60">
                {data
                  ? `${data.marketing.broadcastsSent.toLocaleString()} broadcasts sent · ${data.marketing.broadcastsLast7d} this week`
                  : "Loading…"}
              </span>
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          {data ? (
            <p className="px-1 text-[11px] text-slate-400">
              Updated {new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
