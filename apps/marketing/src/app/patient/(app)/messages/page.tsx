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
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { useConversations, usePatientProfile } from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";

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
          (c.doctor?.name || "").toLowerCase().includes(q) ||
          (c.lastMessagePreview || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [rawConversations, activeFilter, search]);

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<ShieldCheck size={13} aria-hidden />}
        kicker="Secure Clinical Messaging"
        title="Messages & Care Team Communications"
        description="Direct, HIPAA-compliant messaging with your doctors, specialists, and care team coordinators."
        status={
          unreadCount > 0 ? (
            <HeroStatusPill label={`${unreadCount} unread`} tone="warn" />
          ) : (
            <HeroStatusPill label="All caught up" tone="success" />
          )
        }
        actions={
          <>
            <Link href="/patient/care-team" className={heroSecondaryAction}>
              <Users size={13} aria-hidden />
              My Care Team
            </Link>
            <Link href="/patient/ai/chat" className={heroPrimaryAction}>
              <Bot size={14} aria-hidden />
              Ask AI Assistant
            </Link>
          </>
        }
        footer={
          <>
            <span>Active Threads · {rawConversations.length}</span>
            <span>Unread Messages · {unreadCount}</span>
            <span>Connected Doctors · {careTeamMembers.length || 3} Clinicians</span>
            <span>Encryption · End-to-End</span>
          </>
        }
      />

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-xl border border-border shadow-card">
        {/* Filter Tabs */}
        <SegmentedTabs
          ariaLabel="Message filters"
          activeId={activeFilter}
          onChange={(id) => setActiveFilter(id as "all" | "unread")}
          tabs={[
            { id: "all", label: <>All Messages ({rawConversations.length})</> },
            {
              id: "unread",
              label: (
                <>
                  <span>Unread</span>
                  {unreadCount > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-600 text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </>
              ),
            },
          ]}
        />

        {/* Live Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations by doctor or keyword..."
            className="pt-input pl-9 pr-8 !h-9 text-xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
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
                className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-card flex flex-col gap-6">
            {/* Header notification */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-ink text-brand-soft shrink-0 shadow-2xs" aria-hidden>
                <MessageCircle size={24} />
              </div>
              <div className="flex-1">
                <h3 className="t-card-title text-text">
                  {search
                    ? "No conversations match your search"
                    : "No Active Care Team Conversations"}
                </h3>
                <p className="text-xs sm:text-sm text-text-soft mt-1 max-w-xl leading-relaxed">
                  {search
                    ? `No message threads found matching "${search}". Clear search or filter.`
                    : "Doctors and clinical care teams open secure message channels for appointment follow-ups, diagnostic reviews, and prescription adjustments."}
                </p>
              </div>

              <Link
                href="/patient/appointments/book"
                className="pt-btn pt-btn-primary h-10 px-5 text-xs shrink-0"
              >
                <Calendar size={14} aria-hidden />
                Book Consultation
              </Link>
            </div>

            {/* Quick Reach Out to Care Team Doctors */}
            {careTeamMembers.length > 0 ? (
              <div className="pt-4 border-t border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Your Connected Healthcare Providers
                  </h4>
                  <Link
                    href="/patient/care-team"
                    className="text-xs font-bold text-brand hover:underline"
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
                        className="p-3.5 rounded-xl bg-surface-2 border border-border flex flex-col justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-md bg-ink text-brand-soft font-mono text-xs font-bold shrink-0 shadow-2xs" aria-hidden>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-text truncate">
                              {doctor.doctorName.startsWith("Dr.") ? doctor.doctorName : `Dr. ${doctor.doctorName}`}
                            </p>
                            <p className="text-[11px] text-text-soft truncate">
                              {doctor.doctorSpecialization || "General Medicine"}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={`/patient/appointments/book?doctorId=${doctor.doctorId || ""}`}
                          className="pt-btn pt-btn-secondary h-8 w-full text-xs"
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
              const initials = getDoctorInitials(c.doctor?.name ?? "Dr");
              const hasUnread = (c.patientUnread || 0) > 0;

              return (
                <Link
                  key={c.id}
                  href={`/patient/messages/${c.id}`}
                  className={cn(
                    "group rounded-xl border bg-surface p-4 sm:p-5 shadow-card hover:shadow-md hover:border-border-strong transition-all flex items-center justify-between gap-4",
                    hasUnread
                      ? "border-brand/40 bg-brand-soft/30"
                      : "border-border",
                  )}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Doctor Avatar */}
                    <div className="grid h-12 w-12 place-items-center rounded-lg bg-ink text-brand-soft font-mono font-bold text-sm shrink-0 shadow-xs group-hover:scale-105 transition-transform overflow-hidden" aria-hidden>
                      {c.doctor?.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.doctor.photo}
                          alt={c.doctor.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text text-sm sm:text-base group-hover:text-brand transition-colors truncate">
                          {c.doctor?.name ?? "Attending Physician"}
                        </h3>
                        {hasUnread ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand text-white shadow-2xs">
                            {c.patientUnread} new
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-text-soft truncate mt-0.5 max-w-md font-medium">
                        {c.lastMessagePreview || "No messages in thread yet."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-text-muted font-medium">
                      {formatRelative(c.lastMessageAt)}
                    </span>
                    <ChevronRight size={16} className="text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Clinical Assistance Callout ──────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-violet-50 text-violet-600 shrink-0" aria-hidden>
            <Bot size={22} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              Need Instant Clinical Insights?
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              Ask HealthHub AI about symptoms, drug interactions, or preparation for doctor consultations.
            </p>
          </div>
        </div>

        <Link
          href="/patient/ai/chat"
          className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
        >
          <Sparkles size={13} aria-hidden />
          Launch AI Triage Chat
        </Link>
      </section>
    </div>
  );
}
