"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Plus,
  Search,
  User,
  Video,
  X,
} from "lucide-react";

import { useAppointments } from "@/patient/hooks";
import { formatTime, humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { StatusDots } from "@/patient/components/primitives/StatusDots";
import type { ClinicalStatus } from "@/patient/components/primitives/StatusDots";
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";
import { teleconsultApi } from "@/portal/lib/api";
import type { VisitBucket } from "@healthcare/shared/visit-lifecycle";

type TabFilter = "all" | VisitBucket;

function getStatusBadge(status: string): { label: string; tone: ClinicalStatus } {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", tone: "confirmed" };
    case "completed":
      return { label: "Completed", tone: "completed" };
    case "in_progress":
      return { label: "In Progress", tone: "in_progress" };
    case "scheduled":
      return { label: "Scheduled", tone: "scheduled" };
    case "no_show":
      return { label: "Missed", tone: "missed" };
    case "cancelled":
      return { label: "Cancelled", tone: "cancelled" };
    default:
      return { label: humanize(status), tone: "pending" };
  }
}

export default function AppointmentsPage() {
  const query = useAppointments();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  // Live teleconsult session (if the doctor already opened a room).
  // Polls so "Join Call" picks the real roomId over the __pending__
  // waiting room as soon as the session exists. Plain effect+interval
  // (not react-query) — this page's tests render without a provider.
  const [activeSession, setActiveSession] = useState<{
    id: string;
    roomId: string;
    status: string;
    appointmentId: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await teleconsultApi.getActiveForMe();
        if (!cancelled) setActiveSession(res.session);
      } catch {}
    };
    load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const rawAppointments = query.data?.appointments ?? [];

  const { upcomingList, completedList, missedList, cancelledList } = useMemo(() => {
    const sorted = [...rawAppointments].sort((a, b) =>
      (b.date + b.time).localeCompare(a.date + a.time)
    );
    const byBucket = (b: VisitBucket) => sorted.filter((a) => a.bucket === b);
    return {
      upcomingList: [...byBucket("today"), ...byBucket("upcoming")],
      completedList: byBucket("completed"),
      missedList: byBucket("missed"),
      cancelledList: byBucket("cancelled"),
    };
  }, [rawAppointments]);

  const filteredAppointments = useMemo(() => {
    let list = rawAppointments;

    if (activeTab === "upcoming") {
      list = upcomingList;
    } else if (activeTab === "completed") {
      list = completedList;
    } else if (activeTab === "missed") {
      list = missedList;
    } else if (activeTab === "cancelled") {
      list = cancelledList;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          (a.doctorName || "").toLowerCase().includes(q) ||
          (a.doctorSpecialization || "").toLowerCase().includes(q) ||
          (a.hospitalName || "").toLowerCase().includes(q) ||
          (a.reason || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [rawAppointments, activeTab, upcomingList, completedList, missedList, cancelledList, search]);

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<Calendar size={13} />}
        kicker="Care Team Schedule"
        title="Doctor Visits & Appointments"
        description="Schedule and manage in-person clinical consultations, hospital follow-ups, and live video teleconsultations."
        actions={
          <>
            <Link href="/patient/care-team" className={heroSecondaryAction}>
              <User size={13} />
              <span>My Doctors</span>
            </Link>
            <Link href="/patient/appointments/book" className={heroPrimaryAction}>
              <Plus size={14} />
              <span>Book Appointment</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>{rawAppointments.length} total visits</span>
            <span>{upcomingList.length} upcoming</span>
            <span>{completedList.length} completed</span>
            <span>{missedList.length} missed</span>
            <span>{cancelledList.length} cancelled</span>
          </>
        }
      />

      {/* ── 2. Filter & Search Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-2xl shadow-card">
        {/* Segmented Filter Switcher */}
        <SegmentedTabs
          ariaLabel="Appointment filters"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as TabFilter)}
          tabs={[
            { id: "all", label: <>All ({rawAppointments.length})</> },
            { id: "upcoming", label: <>Upcoming ({upcomingList.length})</> },
            { id: "completed", label: <>Completed ({completedList.length})</> },
            { id: "missed", label: <>Missed ({missedList.length})</> },
            { id: "cancelled", label: <>Cancelled ({cancelledList.length})</> },
          ]}
        />

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doctor, hospital, clinic..."
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

      {/* ── 3. Appointments List ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {query.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="rounded-2xl border-border bg-surface p-10 text-center flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="font-bold text-text text-sm">
                No appointments found
              </h3>
              <p className="text-xs text-text-soft max-w-sm mt-0.5">
                {search
                  ? `No visits match "${search}". Try clearing your search.`
                  : activeTab === "upcoming"
                  ? "You have no upcoming consultations scheduled. Book a visit or video teleconsultation with our certified specialists."
                  : "No appointments match the selected filter."}
              </p>
            </div>
            <Link
              href="/patient/appointments/book"
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              <Plus size={14} />
              <span>Book Appointment</span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredAppointments.map((a) => {
              const badge = getStatusBadge(a.status);
              const isVideo = a.mode === "video";
              const isUpcoming = a.bucket === "upcoming" || a.bucket === "today";

              return (
                <div
                  key={a.id}
                  className="group patient-card p-4 sm:p-5 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Column: Date Tile + Doctor Info */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Date Block */}
                    <div className="h-14 w-14 rounded-xl bg-surface-2 border border-border flex flex-col items-center justify-center shrink-0 shadow-2xs group-hover:border-sky-200 group-hover:bg-sky-50/50 transition-colors">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                        {new Date(a.date).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-lg font-black text-text leading-none mt-0.5">
                        {new Date(a.date).getDate()}
                      </span>
                      <span className="text-[9px] font-semibold text-text-muted">
                        {new Date(a.date).toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-text group-hover:text-sky-800 transition-colors truncate">
                          {a.doctorName ?? "Consulting Physician"}
                        </h3>
                        {a.doctorSpecialization ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-surface-2 text-text">
                            {a.doctorSpecialization}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-text-soft font-medium">
                        <span className="inline-flex items-center gap-1 text-text font-semibold">
                          <Clock size={12} className="text-text-muted" />
                          {formatTime(a.time)}
                        </span>

                        <span>·</span>

                        <span className="inline-flex items-center gap-1">
                          {isVideo ? (
                            <>
                              <Video size={12} className="text-purple-600" />
                              <span className="text-purple-700 font-semibold">Video Teleconsultation</span>
                            </>
                          ) : (
                            <>
                              <Building2 size={12} className="text-text-muted" />
                              <span>{a.hospitalName ?? "Hospital Consultation"}</span>
                            </>
                          )}
                        </span>

                        {a.queueNumber ? (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5 text-sky-800 font-bold bg-sky-50 px-2 py-0.5 rounded-md">
                              Queue #{a.queueNumber}
                            </span>
                          </>
                        ) : null}
                      </div>

                      {a.reason ? (
                        <p className="text-xs text-text-soft mt-1 truncate max-w-md">
                          <span className="font-semibold text-text">Reason:</span> {a.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Right Column: Status Badge & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border shrink-0">
                    <StatusDots status={badge.tone} label={badge.label} />

                    <div className="flex items-center gap-2">
                      {isVideo && a.isLive && activeSession?.appointmentId === a.id ? (
                        <Link
                          href={`/patient/teleconsult/${activeSession.roomId}`}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1"
                          style={{
                            background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
                          }}
                        >
                          <Video size={13} />
                          <span>Join Call</span>
                        </Link>
                      ) : isVideo && (a.bucket === "today" || a.isLive) ? (
                        <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-text-soft bg-surface-2 border border-border">
                          {a.isLive ? "Waiting for doctor" : "Starts soon"}
                        </span>
                      ) : null}

                      <Link
                        href={`/patient/appointments/${a.id}`}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-text bg-surface-2 hover:bg-surface-3 transition-colors flex items-center gap-1"
                      >
                        <span>Details</span>
                        <ChevronRight size={13} />
                      </Link>

                      {a.bucket === "missed" || a.bucket === "cancelled" || a.bucket === "completed" ? (
                        <Link
                          href={`/patient/appointments/book?doctorId=${a.doctorId}`}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/70 transition-colors"
                        >
                          Book Again
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
