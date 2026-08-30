"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Plus,
  RotateCcw,
  Search,
  User,
  Video,
  X,
  XCircle,
} from "lucide-react";

import { useAppointments } from "@/patient/hooks";
import { formatTime, humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

type TabFilter = "all" | "upcoming" | "completed" | "past";

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
        icon: CheckCircle2,
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-blue-50 text-blue-700 border-blue-200/70",
        icon: CheckCircle2,
      };
    case "in_progress":
      return {
        label: "In Progress",
        className: "bg-amber-50 text-amber-800 border-amber-200/70 animate-pulse",
        icon: Clock,
      };
    case "scheduled":
      return {
        label: "Scheduled",
        className: "bg-sky-50 text-sky-700 border-sky-200/70",
        icon: Calendar,
      };
    case "no_show":
      return {
        label: "No Show",
        className: "bg-rose-50 text-rose-700 border-rose-200/70",
        icon: AlertCircle,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-slate-100 text-slate-600 border-slate-200",
        icon: XCircle,
      };
    default:
      return {
        label: humanize(status),
        className: "bg-slate-50 text-slate-600 border-slate-200",
        icon: Calendar,
      };
  }
}

export default function AppointmentsPage() {
  const query = useAppointments();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  const rawAppointments = query.data?.appointments ?? [];

  const today = new Date().toISOString().slice(0, 10);

  const { upcomingList, completedList, pastList } = useMemo(() => {
    const sorted = [...rawAppointments].sort((a, b) =>
      (b.date + b.time).localeCompare(a.date + a.time)
    );

    const upcoming = sorted.filter(
      (a) => a.date >= today && a.status !== "cancelled" && a.status !== "no_show" && a.status !== "completed"
    );
    const completed = sorted.filter((a) => a.status === "completed");
    const past = sorted.filter(
      (a) => a.date < today || a.status === "no_show" || a.status === "cancelled"
    );

    return {
      upcomingList: upcoming,
      completedList: completed,
      pastList: past,
    };
  }, [rawAppointments, today]);

  const filteredAppointments = useMemo(() => {
    let list = rawAppointments;

    if (activeTab === "upcoming") {
      list = upcomingList;
    } else if (activeTab === "completed") {
      list = completedList;
    } else if (activeTab === "past") {
      list = pastList;
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
  }, [rawAppointments, activeTab, upcomingList, completedList, pastList, search]);

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
                <Calendar size={12} className="text-sky-300" />
                Care Team Schedule
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Doctor Visits &amp; Appointments
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Schedule and manage in-person clinical consultations, hospital follow-ups, and live video teleconsultations.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/care-team"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <User size={13} />
                <span>My Doctors</span>
              </Link>
              <Link
                href="/patient/appointments/book"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <Plus size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>Book Appointment</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "all"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <Calendar size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Total Visits
                </p>
                <p className="text-base font-extrabold text-white">
                  {rawAppointments.length}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("upcoming")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "upcoming"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Upcoming
                </p>
                <p className="text-base font-extrabold text-white">
                  {upcomingList.length}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "completed"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Completed
                </p>
                <p className="text-base font-extrabold text-white">
                  {completedList.length}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("past")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "past"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-rose-400/30 flex items-center justify-center text-rose-200 shrink-0">
                <RotateCcw size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Past / Missed
                </p>
                <p className="text-base font-extrabold text-white">
                  {pastList.length}
                </p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Filter & Search Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Segmented Filter Switcher */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "all"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            All ({rawAppointments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "upcoming"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Upcoming ({upcomingList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "completed"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Completed ({completedList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("past")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              activeTab === "past"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Past &amp; Missed ({pastList.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doctor, hospital, clinic..."
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

      {/* ── 3. Appointments List ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {query.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                No appointments found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-0.5">
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
              const BadgeIcon = badge.icon;
              const isVideo = a.mode === "video";
              const isUpcoming = a.date >= today && a.status !== "cancelled" && a.status !== "no_show";

              return (
                <div
                  key={a.id}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Column: Date Tile + Doctor Info */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Date Block */}
                    <div className="h-14 w-14 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-center shrink-0 shadow-2xs group-hover:border-sky-200 group-hover:bg-sky-50/50 transition-colors">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                        {new Date(a.date).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-lg font-black text-slate-900 leading-none mt-0.5">
                        {new Date(a.date).getDate()}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400">
                        {new Date(a.date).toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-800 transition-colors truncate">
                          {a.doctorName ?? "Consulting Physician"}
                        </h3>
                        {a.doctorSpecialization ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">
                            {a.doctorSpecialization}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 font-medium">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                          <Clock size={12} className="text-slate-400" />
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
                              <Building2 size={12} className="text-slate-400" />
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
                        <p className="text-xs text-slate-500 mt-1 truncate max-w-md">
                          <span className="font-semibold text-slate-700">Reason:</span> {a.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Right Column: Status Badge & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                        badge.className,
                      )}
                    >
                      <BadgeIcon size={13} />
                      <span>{badge.label}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {isVideo && isUpcoming ? (
                        <Link
                          href={`/patient/appointments/${a.id}`}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1"
                          style={{
                            background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
                          }}
                        >
                          <Video size={13} />
                          <span>Join Call</span>
                        </Link>
                      ) : null}

                      <Link
                        href={`/patient/appointments/${a.id}`}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1"
                      >
                        <span>Details</span>
                        <ChevronRight size={13} />
                      </Link>

                      {a.status === "no_show" || a.status === "cancelled" || a.status === "completed" ? (
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
