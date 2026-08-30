"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Droplet,
  FileText,
  HeartPulse,
  Mail,
  Phone,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TestTube2,
} from "lucide-react";

import { usePatientHeader } from "@/portal/components/patient/PatientHeader";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { cn } from "@/portal/lib/utils";
import { useT } from "@/portal/i18n";
import { ageFrom } from "@/portal/lib/format";

const TABS = [
  { key: "overview", path: "/overview", label: "Overview" },
  { key: "records", path: "/records", label: "Records" },
  { key: "medications", path: "/medications", label: "Medications" },
  { key: "vitals", path: "/vitals", label: "Vitals" },
  { key: "allergies", path: "/allergies", label: "Allergies" },
  { key: "prescriptions", path: "/prescriptions", label: "Prescriptions" },
  { key: "lab-orders", path: "/lab-orders", label: "Lab orders" },
  { key: "vaccinations", path: "/vaccinations", label: "Vaccinations" },
  { key: "clinical-notes", path: "/clinical-notes", label: "Clinical notes" },
  { key: "follow-ups", path: "/follow-ups", label: "Follow-ups" },
  { key: "visits", path: "/visits", label: "Visits" },
  { key: "imaging", path: "/imaging", label: "Imaging & PACS" },
  { key: "messages", path: "/messages", label: "Messages" },
  { key: "share", path: "/share", label: "Share" },
] as const;

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

  const patient = data?.patient;
  const user = data?.user;
  const allergies = data?.allergies ?? [];
  const chronicConditions = data?.chronicConditions ?? [];
  const age = patient?.dob ? ageFrom(patient.dob) : null;

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* ── 1. Signature Oceanic Patient Chart Hero ────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          {/* Top navigation & action bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link
              href="/portal/patients"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/20 transition-all backdrop-blur-md"
            >
              <ArrowLeft size={13} />
              <span>Back to Patient Registry</span>
            </Link>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Link
                href={`/portal/prescriptions/new?patientId=${id}`}
                className="hero-action-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <Pill size={13} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>+ New Rx</span>
              </Link>
              <Link
                href={`/portal/clinical-notes/new?patientId=${id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/20 transition-all backdrop-blur-md"
              >
                <FileText size={13} />
                <span>+ Clinical Note</span>
              </Link>
              <Link
                href={`/portal/lab-orders/new?patientId=${id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/20 transition-all backdrop-blur-md"
              >
                <TestTube2 size={13} />
                <span>+ Order Lab</span>
              </Link>
            </div>
          </div>

          {/* Patient Profile Stage */}
          {isLoading ? (
            <div className="flex items-center gap-4 py-2">
              <Skeleton className="h-16 w-16 rounded-2xl bg-white/20" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-6 w-48 bg-white/20" />
                <Skeleton className="h-4 w-72 bg-white/20" />
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4 flex-wrap pt-1">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  <Avatar
                    name={user?.name ?? "Patient"}
                    src={patient?.photo ?? undefined}
                    size="lg"
                    className="h-16 w-16 text-lg font-extrabold ring-4 ring-white/30 shadow-md"
                  />
                  {allergies.length > 0 && (
                    <span
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-[9px] font-bold"
                      title="Allergies on file"
                    >
                      !
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight truncate">
                      {user?.name ?? "Patient"}
                    </h1>
                    {patient?.bloodGroup && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/90 text-white border border-rose-400 shadow-xs flex items-center gap-1">
                        <Droplet size={11} fill="currentColor" />
                        {patient.bloodGroup}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-white/80">
                    {age != null && (
                      <span className="font-semibold text-sky-100">
                        {age} yrs · {patient?.sex ?? "—"}
                      </span>
                    )}
                    {patient?.nic && (
                      <span className="text-white/70">NIC: {patient.nic}</span>
                    )}
                    {user?.phone && (
                      <span className="inline-flex items-center gap-1 text-white/90">
                        <Phone size={11} className="text-sky-300" />
                        {user.phone}
                      </span>
                    )}
                    {user?.email && (
                      <span className="inline-flex items-center gap-1 text-white/90">
                        <Mail size={11} className="text-sky-300" />
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  EHR Synchronization
                </p>
                <p className="text-base font-extrabold text-white">Full Access</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  allergies.length > 0 ? "bg-rose-500/40 text-rose-200" : "bg-emerald-400/30 text-emerald-200",
                )}
              >
                {allergies.length > 0 ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Allergies
                </p>
                <p className="text-base font-extrabold text-white truncate">
                  {allergies.length > 0 ? `${allergies.length} Alert on File` : "No Known"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <HeartPulse size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Chronic Status
                </p>
                <p className="text-base font-extrabold text-white truncate">
                  {chronicConditions.length > 0
                    ? chronicConditions.map((c) => c.name).join(", ")
                    : "None Declared"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Stethoscope size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Chart Mode
                </p>
                <p className="text-base font-extrabold text-white">Active Patient</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Sticky Tab Navigation Strip ─────────────────────────────────── */}
      <nav className="portal-chart-tabs sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs py-2">
        {TABS.map((tab) => {
          const href = `${base}${tab.path}`;
          const active = pathname.startsWith(href);
          const label = t(`chart.tab.${tab.key}`);
          const displayLabel = label.startsWith("chart.tab.") ? tab.label : label;

          return (
            <Link
              key={tab.key}
              href={href}
              style={{
                backgroundColor: active ? "#0284c7" : "transparent",
                color: active ? "#ffffff" : "#475569",
              }}
              className={cn(
                "px-3.5 py-1.5 text-xs whitespace-nowrap rounded-xl font-bold transition-all cursor-pointer",
                active
                  ? "shadow-sm"
                  : "hover:text-slate-900 hover:bg-slate-100",
              )}
            >
              {displayLabel}
            </Link>
          );
        })}
      </nav>

      {/* ── 3. Page Content ────────────────────────────────────────────────── */}
      <div>{children}</div>
    </div>
  );
}
