"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
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
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { StatusDots } from "@/patient/components/primitives/StatusDots";

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
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<Users size={13} />}
        kicker="Authorized Clinical Providers"
        title="Care Team & Clinicians"
        description="Review and control healthcare professionals authorized to access your electronic health record, prescribe medications, and add clinical notes."
        actions={
          <>
            <Link href="/patient/appointments/book" className={heroSecondaryAction}>
              <Calendar size={13} />
              <span>Book Visit</span>
            </Link>
            <Link href="/patient/care-team/add" className={heroPrimaryAction}>
              <UserPlus size={14} />
              <span>Add Clinician</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>{rawMembers.length} clinicians</span>
            <span>{activeMembers.length} active access</span>
            <span>{primaryCount} primary care</span>
            <span>{pausedMembers.length} paused</span>
          </>
        }
      />

      {/* ── 2. Filter & Search Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-2xl shadow-card">
        {/* Segmented Filter */}
        <div className="inline-flex p-1 bg-surface-2 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeFilter === "all"
                ? "bg-surface text-brand shadow-xs"
                : "text-text-soft hover:text-text",
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
                ? "bg-surface text-brand shadow-xs"
                : "text-text-soft hover:text-text",
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
                ? "bg-surface text-brand shadow-xs"
                : "text-text-soft hover:text-text",
            )}
          >
            Paused ({pausedMembers.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clinician, specialty, or role..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-surface-2 border border-border rounded-xl font-medium text-text placeholder:text-text-muted focus:bg-surface focus:outline-none focus:ring-1 focus:ring-brand transition-all"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-soft"
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
                className="h-28 rounded-2xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-bold text-text text-sm">
                No clinicians found
              </h3>
              <p className="text-xs text-text-soft max-w-sm mt-0.5">
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
                  className="group rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-border-strong transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Column: Doctor Avatar + Clinical Details */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Doctor Initials Avatar */}
                    <div className="h-13 w-13 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-white flex flex-col items-center justify-center shrink-0 shadow-sm font-black text-sm">
                      <span>{initials}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-text group-hover:text-sky-800 transition-colors truncate">
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
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-xs text-text-soft font-medium">
                        <span className="inline-flex items-center gap-1 text-text font-semibold">
                          <UserCheck size={12} className="text-text-muted" />
                          {formattedRole}
                        </span>

                        <span>·</span>

                        <span className="inline-flex items-center gap-1 text-text-soft">
                          <ShieldCheck size={12} className="text-emerald-600" />
                          {formattedScope}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Status & Consent Management Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-border shrink-0">
                    <StatusDots
                      status={isActive ? "confirmed" : isPaused ? "pending" : "cancelled"}
                      label={isActive ? "Active Access" : isPaused ? "Paused" : "Revoked"}
                    />

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
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-text-soft hover:bg-surface-2 border border-border transition-colors cursor-pointer disabled:opacity-50"
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
