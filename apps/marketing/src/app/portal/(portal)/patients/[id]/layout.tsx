"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Droplet,
  FileText,
  FlaskConical,
  FolderOpen,
  HeartPulse,
  IdCard,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Phone,
  Pill,
  ScanLine,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Syringe,
  TestTube2,
  type LucideIcon,
} from "lucide-react";

import { usePatientHeader } from "@/portal/components/patient/PatientHeader";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { cn } from "@/portal/lib/utils";
import { useT } from "@/portal/i18n";
import { ageFrom, formatDate, relativeTime } from "@/portal/lib/format";
import type { PatientOverview } from "@healthcare/shared";

const TABS: ReadonlyArray<{ key: string; path: string; label: string; icon: LucideIcon }> = [
  { key: "overview", path: "/overview", label: "Overview", icon: LayoutDashboard },
  { key: "records", path: "/records", label: "Records", icon: FolderOpen },
  { key: "medications", path: "/medications", label: "Medications", icon: Pill },
  { key: "vitals", path: "/vitals", label: "Vitals", icon: Activity },
  { key: "allergies", path: "/allergies", label: "Allergies", icon: ShieldAlert },
  { key: "prescriptions", path: "/prescriptions", label: "Prescriptions", icon: FileText },
  { key: "lab-orders", path: "/lab-orders", label: "Lab orders", icon: FlaskConical },
  { key: "vaccinations", path: "/vaccinations", label: "Vaccinations", icon: Syringe },
  { key: "clinical-notes", path: "/clinical-notes", label: "Clinical notes", icon: ClipboardList },
  { key: "follow-ups", path: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
  { key: "visits", path: "/visits", label: "Visits", icon: CalendarCheck },
  { key: "imaging", path: "/imaging", label: "Imaging & PACS", icon: ScanLine },
  { key: "messages", path: "/messages", label: "Messages", icon: MessageSquare },
  { key: "share", path: "/share", label: "Share", icon: Share2 },
];

function formatSex(sex?: string | null) {
  if (!sex) return null;
  const s = sex.toLowerCase();
  if (s === "m" || s === "male") return "Male";
  if (s === "f" || s === "female") return "Female";
  return sex.charAt(0).toUpperCase() + sex.slice(1);
}

export default function PatientChartLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const pathname = usePathname();
  const { data, isLoading } = usePatientHeader(id);
  const base = `/portal/patients/${id}`;

  // The header hook shares the overview query, so the full payload is here.
  const overview = data as unknown as Partial<PatientOverview> | undefined;
  const patient = data?.patient;
  const user = data?.user;
  const allergies = data?.allergies ?? [];
  const chronicConditions = data?.chronicConditions ?? [];
  const activeMeds = overview?.activeMedicines ?? [];
  const nextVisit = overview?.visits?.nextScheduled ?? null;
  const lastVisit = overview?.visits?.recent?.[0] ?? null;
  const age = patient?.dob ? ageFrom(patient.dob) : null;
  const sex = formatSex(patient?.sex);

  // Keep the active tab visible when the strip overflows.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="flex flex-col gap-5 pb-12 min-w-0">
      {/* ── 1. Patient identity hero ─────────────────────────────────── */}
      <header className="dashboard-hero relative rounded-3xl text-white overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -right-20 w-80 h-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.30) 0%, transparent 65%)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 w-72 h-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(52,211,153,0.18) 0%, transparent 60%)" }}
          aria-hidden
        />

        <div className="relative z-10 p-5 md:p-7 flex flex-col gap-5">
          {/* Breadcrumb + actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link
              href="/portal/patients"
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-white/75 hover:text-white transition-colors"
            >
              <span className="h-7 w-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <ArrowLeft size={13} />
              </span>
              <span>Patient registry</span>
            </Link>

            <div className="flex items-center gap-2 flex-wrap">
              <HeroAction href={`/portal/clinical-notes/new?patientId=${id}`} icon={<Stethoscope size={14} />}>
                Clinical note
              </HeroAction>
              <HeroAction href={`/portal/lab-orders/new?patientId=${id}`} icon={<TestTube2 size={14} />}>
                Order lab
              </HeroAction>
              <Link
                href={`/portal/prescriptions/new?patientId=${id}`}
                className="hero-action-btn inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold bg-white hover:bg-sky-50 transition-all shadow-lg shadow-sky-950/20 hover:-translate-y-px"
                style={{ color: "#0c4a6e" }}
              >
                <Pill size={14} style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>New prescription</span>
              </Link>
            </div>
          </div>

          {/* Identity */}
          {isLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-[72px] w-[72px] rounded-full bg-white/20" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-7 w-56 bg-white/20" />
                <Skeleton className="h-4 w-80 max-w-full bg-white/15" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 md:gap-5 min-w-0">
              <div className="relative shrink-0">
                <Avatar
                  name={user?.name ?? "Patient"}
                  src={patient?.photo ?? undefined}
                  size="lg"
                  className="h-[72px] w-[72px] text-xl font-extrabold ring-4 ring-white/20 shadow-lg"
                />
                {allergies.length > 0 ? (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center shadow"
                    title={`${allergies.length} allerg${allergies.length === 1 ? "y" : "ies"} on file`}
                  >
                    <ShieldAlert size={12} />
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl md:text-[32px] font-extrabold tracking-tight text-white leading-tight truncate">
                    {user?.name ?? "Patient"}
                  </h1>
                  {patient?.bloodGroup ? (
                    <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-extrabold bg-rose-500 text-white shadow-sm">
                      <Droplet size={11} fill="currentColor" />
                      {patient.bloodGroup}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  {age != null || sex ? (
                    <MetaChip>
                      {[age != null ? `${age} yrs` : null, sex].filter(Boolean).join(" · ")}
                    </MetaChip>
                  ) : null}
                  {patient?.nic ? (
                    <MetaChip icon={<IdCard size={12} />}>
                      <span className="font-mono tracking-tight">{patient.nic}</span>
                    </MetaChip>
                  ) : null}
                  {user?.phone ? (
                    <MetaChip icon={<Phone size={12} />} href={`tel:${user.phone}`}>
                      {user.phone}
                    </MetaChip>
                  ) : null}
                  {user?.email ? (
                    <MetaChip icon={<Mail size={12} />} href={`mailto:${user.email}`}>
                      <span className="truncate max-w-[220px]">{user.email}</span>
                    </MetaChip>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Clinical snapshot — real data only */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <SnapshotTile
              icon={allergies.length > 0 ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
              tone={allergies.length > 0 ? "alert" : "ok"}
              label="Allergies"
              value={
                allergies.length > 0
                  ? allergies.map((a) => a.substance).join(", ")
                  : "None known"
              }
            />
            <SnapshotTile
              icon={<HeartPulse size={16} />}
              tone="amber"
              label="Chronic conditions"
              value={
                chronicConditions.length > 0
                  ? chronicConditions.map((c) => c.name).join(", ")
                  : "None declared"
              }
            />
            <SnapshotTile
              icon={<Pill size={16} />}
              tone="sky"
              label="Active medications"
              value={
                activeMeds.length > 0
                  ? `${activeMeds.length} active`
                  : "None active"
              }
              sub={activeMeds.slice(0, 2).map((m) => m.name).join(", ") || undefined}
            />
            <SnapshotTile
              icon={<CalendarCheck size={16} />}
              tone="violet"
              label={nextVisit ? "Next visit" : "Last visit"}
              value={
                nextVisit
                  ? relativeTime(nextVisit.date)
                  : lastVisit
                    ? relativeTime(lastVisit.date)
                    : "No visits yet"
              }
              sub={
                nextVisit
                  ? `${formatDate(nextVisit.date)}${nextVisit.time ? " · " + nextVisit.time : ""}`
                  : lastVisit
                    ? formatDate(lastVisit.date)
                    : undefined
              }
            />
          </div>
        </div>
      </header>

      {/* ── 2. Sticky tab navigation ─────────────────────────────────── */}
      <nav className="sticky top-0 z-30 min-w-0" aria-label="Patient chart sections">
        <div className="portal-chart-tabs relative rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm">
          <div
            ref={tabsRef}
            className="flex items-center gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map((tab) => {
              const href = `${base}${tab.path}`;
              const active = pathname.startsWith(href);
              const label = t(`chart.tab.${tab.key}`);
              const displayLabel = label.startsWith("chart.tab.") ? tab.label : label;
              const Icon = tab.icon;
              const badge =
                tab.key === "allergies" && allergies.length > 0
                  ? allergies.length
                  : tab.key === "medications" && activeMeds.length > 0
                    ? activeMeds.length
                    : null;

              return (
                <Link
                  key={tab.key}
                  href={href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  style={active ? { backgroundColor: "#0284c7", color: "#ffffff" } : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-9 px-3 text-[13px] whitespace-nowrap rounded-xl font-semibold transition-colors shrink-0",
                    active
                      ? "shadow-md shadow-sky-600/25"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                  )}
                >
                  <Icon size={14} className={active ? "opacity-100" : "opacity-60"} />
                  {displayLabel}
                  {badge != null ? (
                    <span
                      className={cn(
                        "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums inline-flex items-center justify-center",
                        active
                          ? "bg-white/25 text-white"
                          : tab.key === "allergies"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
          {/* Edge fade hints that the strip scrolls */}
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 rounded-r-2xl bg-gradient-to-l from-white to-transparent xl:hidden"
            aria-hidden
          />
        </div>
      </nav>

      {/* ── 3. Page content ──────────────────────────────────────────── */}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function HeroAction({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors backdrop-blur-md"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function MetaChip({
  icon,
  href,
  children,
}: {
  icon?: React.ReactNode;
  href?: string;
  children: React.ReactNode;
}) {
  const cls =
    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-white/90 bg-white/10 border border-white/10 min-w-0";
  const inner = (
    <>
      {icon ? <span className="text-sky-200 shrink-0">{icon}</span> : null}
      {children}
    </>
  );
  return href ? (
    <a href={href} className={cn(cls, "hover:bg-white/20 transition-colors")}>
      {inner}
    </a>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

const SNAPSHOT_TONES = {
  ok: "bg-emerald-400/25 text-emerald-100",
  alert: "bg-rose-500 text-white",
  amber: "bg-amber-400/25 text-amber-100",
  sky: "bg-sky-400/25 text-sky-100",
  violet: "bg-violet-400/25 text-violet-100",
} as const;

function SnapshotTile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof SNAPSHOT_TONES;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl border backdrop-blur-sm min-w-0",
        tone === "alert"
          ? "bg-rose-500/15 border-rose-300/40"
          : "bg-white/[0.08] border-white/10",
      )}
    >
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", SNAPSHOT_TONES[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-wider font-bold text-white/60 truncate">{label}</p>
        <p className="text-sm md:text-[15px] font-bold text-white truncate" title={value}>
          {value}
        </p>
        {sub ? <p className="text-[11px] text-white/55 truncate" title={sub}>{sub}</p> : null}
      </div>
    </div>
  );
}
