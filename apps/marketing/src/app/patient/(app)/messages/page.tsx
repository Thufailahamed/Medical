"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Mail,
  MessageCircle,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { useConversations, usePatientProfile } from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";
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

function getDoctorInitials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/i, "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function MessagesPage() {
  const query = useConversations();
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";

  const [activeFilter, setActiveFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");

  const careTeamQ = useQuery({
    queryKey: ["patient", "care-team", patientId],
    queryFn: () =>
      api<{ members: CareTeamMember[] }>(
        `/care-team?patientId=${encodeURIComponent(patientId)}`,
      ),
    enabled: Boolean(patientId),
  });

  const rawConversations = query.data?.conversations ?? [];
  const careTeamMembers = careTeamQ.data?.members?.filter((m) => m.status === "active") ?? [];

  const unreadCount = useMemo(() => {
    return rawConversations.reduce((acc, c) => acc + (c.patientUnread || 0), 0);
  }, [rawConversations]);

  const filteredConversations = useMemo(() => {
    let list = rawConversations;
    if (activeFilter === "unread") {
      list = list.filter((c) => (c.patientUnread || 0) > 0);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.doctorName || "").toLowerCase().includes(q) ||
          (c.lastMessagePreview || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [rawConversations, activeFilter, search]);

  return (
    <div className="flex flex-col gap-6 pb-16">
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
                <ShieldCheck size={12} className="text-sky-300" />
                Secure Clinical Messaging
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Messages &amp; Care Team Communications
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Direct, HIPAA-compliant messaging with your doctors, specialists, and care team coordinators.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/care-team"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Users size={13} />
                <span>My Care Team</span>
              </Link>
              <Link
                href="/patient/ai/chat"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <Bot size={14} className="text-sky-700" />
                <span>Ask AI Assistant</span>
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
                <MessageSquare size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active Threads
                </p>
                <p className="text-base font-extrabold text-white">
                  {rawConversations.length}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("unread")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeFilter === "unread"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <Mail size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-emerald-200 truncate">
                  Unread Messages
                </p>
                <p className="text-base font-extrabold text-white">
                  {unreadCount}
                </p>
              </div>
            </button>

            <Link
              href="/patient/care-team"
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-all"
            >
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Stethoscope size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Connected Doctors
                </p>
                <p className="text-base font-extrabold text-white">
                  {careTeamMembers.length || 3} Clinicians
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Encryption
                </p>
                <p className="text-base font-extrabold text-white">End-to-End</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Filter Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeFilter === "all"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            All Messages ({rawConversations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("unread")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "unread"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <span>Unread</span>
            {unreadCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-600 text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations by doctor or keyword..."
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

      {/* ── 3. Conversations List or Rich Zero-State ───────────────────────── */}
      <section className="flex flex-col gap-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col gap-6">
            {/* Header notification */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="h-14 w-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0 shadow-2xs">
                <MessageCircle size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {search
                    ? "No conversations match your search"
                    : "No Active Care Team Conversations"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
                  {search
                    ? `No message threads found matching "${search}". Clear search or filter.`
                    : "Doctors and clinical care teams open secure message channels for appointment follow-ups, diagnostic reviews, and prescription adjustments."}
                </p>
              </div>

              <Link
                href="/patient/appointments/book"
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all shrink-0 flex items-center gap-1.5"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                <Calendar size={14} />
                <span>Book Consultation</span>
              </Link>
            </div>

            {/* Quick Reach Out to Care Team Doctors */}
            {careTeamMembers.length > 0 ? (
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Your Connected Healthcare Providers
                  </h4>
                  <Link
                    href="/patient/care-team"
                    className="text-xs font-bold text-sky-700 hover:text-sky-800"
                  >
                    View All
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {careTeamMembers.slice(0, 3).map((doctor) => {
                    const initials = getDoctorInitials(doctor.doctorName);
                    return (
                      <div
                        key={doctor.id}
                        className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {doctor.doctorName.startsWith("Dr.") ? doctor.doctorName : `Dr. ${doctor.doctorName}`}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {doctor.doctorSpecialization || "General Medicine"}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={`/patient/appointments/book?doctorId=${doctor.doctorId || ""}`}
                          className="w-full py-1.5 rounded-lg text-center text-xs font-bold text-sky-800 bg-white hover:bg-sky-50 border border-sky-200/80 transition-colors"
                        >
                          Request Visit &amp; Message
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredConversations.map((c) => {
              const initials = getDoctorInitials(c.doctorName ?? "Dr");
              const hasUnread = (c.patientUnread || 0) > 0;

              return (
                <Link
                  key={c.id}
                  href={`/patient/messages/${c.id}`}
                  className={cn(
                    "group rounded-2xl border bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex items-center justify-between gap-4",
                    hasUnread
                      ? "border-sky-300 bg-sky-50/30 ring-1 ring-sky-400/20"
                      : "border-slate-200/90",
                  )}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Doctor Avatar */}
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-sky-700 transition-colors truncate">
                          {c.doctorName ?? "Attending Physician"}
                        </h3>
                        {hasUnread ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-600 text-white shadow-2xs">
                            {c.patientUnread} new
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-slate-500 truncate mt-0.5 max-w-md font-medium">
                        {c.lastMessagePreview || "No messages in thread yet."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {formatRelative(c.lastMessageAt)}
                    </span>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Clinical Assistance Callout ──────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Bot size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Need Instant Clinical Insights?
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Ask HealthHub AI about symptoms, drug interactions, or preparation for doctor consultations.
            </p>
          </div>
        </div>

        <Link
          href="/patient/ai/chat"
          className="px-4 py-2 rounded-xl text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Sparkles size={13} className="text-purple-600" />
          <span>Launch AI Triage Chat</span>
        </Link>
      </section>
    </div>
  );
}
