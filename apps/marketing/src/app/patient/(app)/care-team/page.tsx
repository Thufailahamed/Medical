"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Pause,
  Search,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";
import { humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

interface CareTeamMember {
  id: string;
  doctorId?: string;
  doctorName: string;
  doctorSpecialization: string;
  role: string;
  scope: string;
  status: "active" | "paused" | "revoked";
}

function formatRole(role: string): string {
  const r = role.toLowerCase().replace(/_/g, " ");
  if (r.includes("primary")) return "Primary Care Physician";
  if (r.includes("specialist")) return "Consulting Specialist";
  if (r.includes("pharmacist")) return "Clinical Pharmacist";
  if (r.includes("nurse")) return "Registered Nurse";
  return humanize(r);
}

function formatScope(scope: string): string {
  const s = scope.toLowerCase().replace(/_/g, " ");
  if (s.includes("full")) return "Full EMR Access";
  if (s.includes("read")) return "Read-Only Access";
  if (s.includes("summary")) return "Summary View";
  return humanize(s);
}

function getDoctorInitials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/i, "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function CareTeamPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const qc = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "paused">("all");
  const [search, setSearch] = useState("");

  const team = useQuery({
    queryKey: ["patient", "care-team", patientId],
    queryFn: () =>
      api<{ members: CareTeamMember[] }>(
        `/care-team?patientId=${encodeURIComponent(patientId)}`,
      ),
    enabled: Boolean(patientId),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "paused" | "revoked";
    }) => api(`/care-team/${id}`, { method: "PATCH", json: { status } }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["patient", "care-team", patientId] }),
  });

  const rawMembers = team.data?.members ?? [];

  const { activeMembers, pausedMembers, primaryCount } = useMemo(() => {
    const active = rawMembers.filter((m) => m.status === "active");
    const paused = rawMembers.filter((m) => m.status === "paused");
    const primary = rawMembers.filter((m) =>
      m.role.toLowerCase().includes("primary"),
    ).length;
    return {
      activeMembers: active,
      pausedMembers: paused,
      primaryCount: primary,
    };
  }, [rawMembers]);

  const filteredMembers = useMemo(() => {
    let list = rawMembers;
    if (activeFilter === "active") list = activeMembers;
    if (activeFilter === "paused") list = pausedMembers;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.doctorName.toLowerCase().includes(q) ||
          m.doctorSpecialization.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rawMembers, activeFilter, activeMembers, pausedMembers, search]);

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
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
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <Users size={12} className="text-sky-300" />
                Authorized Clinical Providers
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Care Team &amp; Clinicians
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Review and control healthcare professionals authorized to access your electronic health record, prescribe medications, and add clinical notes.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/appointments/book"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Calendar size={13} />
                <span>Book Visit</span>
              </Link>
              <Link
                href="/patient/care-team/add"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <UserPlus size={14} className="text-sky-700" />
                <span>Add Clinician</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeFilter === "all"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <Users size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Total Clinicians
                </p>
                <p className="text-base font-extrabold text-white">
                  {rawMembers.length}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("active")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeFilter === "active"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active Access
                </p>
                <p className="text-base font-extrabold text-white">
                  {activeMembers.length}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Stethoscope size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Primary Care
                </p>
                <p className="text-base font-extrabold text-white">
                  {primaryCount}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveFilter("paused")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeFilter === "paused"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Pause size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Paused Access
                </p>
                <p className="text-base font-extrabold text-white">
                  {pausedMembers.length}
                </p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Filter & Search Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Segmented Filter */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeFilter === "all"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            All ({rawMembers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("active")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeFilter === "active"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Active ({activeMembers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("paused")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeFilter === "paused"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Paused ({pausedMembers.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clinician, specialty, or role..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 3. Clinicians Cards Grid ───────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {team.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                No clinicians found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                {search
                  ? `No doctors match "${search}". Try clearing your search.`
                  : "Connect with your family physician, specialists, or therapists to share records and treatment plans."}
              </p>
            </div>
            <Link
              href="/patient/care-team/add"
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              <UserPlus size={14} />
              <span>Connect First Clinician</span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredMembers.map((member) => {
              const isActive = member.status === "active";
              const isPaused = member.status === "paused";
              const initials = getDoctorInitials(member.doctorName);
              const formattedRole = formatRole(member.role);
              const formattedScope = formatScope(member.scope);

              return (
                <article
                  key={member.id}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Column: Doctor Avatar + Clinical Details */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Doctor Initials Avatar */}
                    <div className="h-13 w-13 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-white flex flex-col items-center justify-center shrink-0 shadow-sm font-black text-sm">
                      <span>{initials}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-800 transition-colors truncate">
                          {member.doctorName.startsWith("Dr.") ? member.doctorName : `Dr. ${member.doctorName}`}
                        </h3>
                        {member.doctorSpecialization ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-100">
                            <Stethoscope size={11} className="text-sky-600" />
                            {member.doctorSpecialization}
                          </span>
                        ) : null}
                      </div>

                      {/* Role & Access Scope tags */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-xs text-slate-500 font-medium">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                          <UserCheck size={12} className="text-slate-400" />
                          {formattedRole}
                        </span>

                        <span>·</span>

                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <ShieldCheck size={12} className="text-emerald-600" />
                          {formattedScope}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Status & Consent Management Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                          : isPaused
                          ? "bg-amber-50 text-amber-800 border-amber-200/80"
                          : "bg-slate-100 text-slate-600 border-slate-200",
                      )}
                    >
                      {isActive ? (
                        <CheckCircle2 size={12} className="text-emerald-600" />
                      ) : (
                        <Pause size={12} className="text-amber-600" />
                      )}
                      <span>{isActive ? "Active Access" : isPaused ? "Paused" : "Revoked"}</span>
                    </span>

                    {member.status !== "revoked" ? (
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/patient/appointments/book?doctorId=${member.doctorId || ""}`}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/70 transition-colors"
                        >
                          Book Visit
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            update.mutate({
                              id: member.id,
                              status: isActive ? "paused" : "active",
                            })
                          }
                          disabled={update.isPending}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isActive ? "Pause" : "Resume"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Revoke health record access for ${member.doctorName}? They will no longer be able to view your clinical data.`,
                              )
                            ) {
                              update.mutate({ id: member.id, status: "revoked" });
                            }
                          }}
                          disabled={update.isPending}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200/70 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
