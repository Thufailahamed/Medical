"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Calendar,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { useConversations, usePatientProfile } from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  RowAccent,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

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

  const rawConversations = useMemo(
    () => query.data?.conversations ?? [],
    [query.data?.conversations],
  );
  const careTeamMembers = useMemo(
    () => careTeamQ.data?.members?.filter((m) => m.status === "active") ?? [],
    [careTeamQ.data?.members],
  );

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
    <PatientPage>
      <PatientHero
        kickerIcon={<ShieldCheck size={13} aria-hidden />}
        kicker="Secure messaging"
        kickerMeta="End-to-end encrypted"
        title={
          <>
            Messages &amp; <HeroAccent>Care Team Communications</HeroAccent>
          </>
        }
        description="Direct, HIPAA-compliant messaging with your doctors, specialists, and care team coordinators."
        chips={
          <>
            <span className={HERO_CHIP}>
              <MessageCircle size={12} className="text-sky-300" />
              {rawConversations.length} threads
            </span>
            {unreadCount > 0 ? (
              <span className={HERO_CHIP}>
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                {unreadCount} unread
              </span>
            ) : (
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" />
                All caught up
              </span>
            )}
            <span className={HERO_CHIP}>{careTeamMembers.length} clinicians linked</span>
          </>
        }
        actions={
          <>
            <Link href="/patient/care-team" className={HERO_GHOST}>
              <Users size={13} /> My care team
            </Link>
            <Link href="/patient/ai/chat" className={HERO_PRIMARY}>
              <Bot size={14} className="text-sky-600" /> Ask AI assistant
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<MessageCircle size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Threads"
          value={String(rawConversations.length)}
          sub="Active conversations"
          active={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
        />
        <StatTile
          icon={<ShieldCheck size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Unread"
          value={String(unreadCount)}
          sub={unreadCount > 0 ? "Needs your reply" : "All caught up"}
          pulse={unreadCount > 0}
          active={activeFilter === "unread"}
          onClick={() => setActiveFilter("unread")}
        />
        <StatTile
          icon={<Users size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Care team"
          value={String(careTeamMembers.length)}
          sub="Connected clinicians"
          href="/patient/care-team"
        />
        <StatTile
          icon={<Sparkles size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="AI triage"
          value="24/7"
          sub="Instant symptom checks"
          href="/patient/ai/chat"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<MessageCircle size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Conversations"
              caption={`${filteredConversations.length} of ${rawConversations.length} threads`}
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Segmented
                ariaLabel="Message filters"
                options={[
                  { value: "all", label: "All", count: rawConversations.length },
                  { value: "unread", label: "Unread", count: unreadCount },
                ]}
                value={activeFilter}
                onChange={(v) => setActiveFilter(v as "all" | "unread")}
              />
              <PanelSearch
                value={search}
                onChange={setSearch}
                placeholder="Search conversations by doctor or keyword…"
                className="flex-1 sm:max-w-xs"
              />
            </div>

            {query.isLoading ? (
              <div className="mt-4 flex flex-col gap-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <EmptyBlock
                icon={<MessageCircle size={19} />}
                title={search ? "No conversations match your search" : "No care team conversations"}
                body={
                  search
                    ? `No threads found matching "${search}". Clear search or filter.`
                    : "Doctors and care teams open secure channels for follow-ups, reviews, and prescription adjustments."
                }
                actions={
                  !search ? (
                    <Link
                      href="/patient/appointments/book"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500"
                    >
                      <Calendar size={14} /> Book consultation
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {filteredConversations.map((c) => {
                  const initials = getDoctorInitials(c.doctor?.name ?? "Dr");
                  const hasUnread = (c.patientUnread || 0) > 0;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/patient/messages/${c.id}`}
                        className={cn(
                          LIST_ROW,
                          "group",
                          hasUnread && "bg-sky-50/40 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.25)]",
                        )}
                      >
                        <RowAccent className={hasUnread ? "bg-sky-500" : "bg-slate-200"} />
                        <div
                          className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#0B1F3A] font-mono text-sm font-bold text-sky-200 transition-transform group-hover:scale-105"
                          aria-hidden
                        >
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-sky-700 sm:text-base">
                              {c.doctor?.name ?? "Attending Physician"}
                            </h3>
                            {hasUnread ? (
                              <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                                {c.patientUnread} new
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 max-w-md truncate text-xs font-medium text-slate-500">
                            {c.lastMessagePreview || "No messages in thread yet."}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-[11px] font-medium text-slate-400">
                            {formatRelative(c.lastMessageAt)}
                          </span>
                          <ChevronRight
                            size={16}
                            className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-sky-600"
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          {careTeamMembers.length > 0 ? (
            <section className={PANEL}>
              <PanelHeader
                icon={<Users size={16} />}
                tone="bg-violet-50 text-violet-600"
                title="Your care team"
                caption="Message via a new consultation."
                href="/patient/care-team"
                linkLabel="View all"
              />
              <div className="mt-4 flex flex-col gap-2">
                {careTeamMembers.slice(0, 3).map((doctor) => (
                  <div
                    key={doctor.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#0B1F3A] font-mono text-[11px] font-bold text-sky-200"
                      aria-hidden
                    >
                      {getDoctorInitials(doctor.doctorName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {doctor.doctorName.startsWith("Dr.")
                          ? doctor.doctorName
                          : `Dr. ${doctor.doctorName}`}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {doctor.doctorSpecialization || "General Medicine"}
                      </p>
                    </div>
                    <Link
                      href={`/patient/appointments/book?doctorId=${doctor.doctorId || ""}`}
                      className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
                    >
                      Visit
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <PromoCard
            icon={<Bot size={21} aria-hidden />}
            kicker="Instant insights"
            title="Ask HealthHub AI"
            body="Symptoms, drug interactions, or prep for your next consult — answered in seconds."
            href="/patient/ai/chat"
          />

          <QuickToolsPanel
            id="msg-tools"
            title="Tools"
            tools={[
              {
                icon: Calendar,
                label: "Appointments",
                hint: "Book a visit",
                href: "/patient/appointments",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: ShieldCheck,
                label: "Notifications",
                hint: "Alerts & updates",
                href: "/patient/notifications",
                tone: "from-amber-500 to-orange-500 shadow-amber-500/30",
              },
              {
                icon: Users,
                label: "Care team",
                hint: "Clinicians",
                href: "/patient/care-team",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}
