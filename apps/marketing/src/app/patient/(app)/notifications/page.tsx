"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  FlaskConical,
  Pill,
  Search,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

function cleanNotificationBody(body: string | null | undefined): string {
  if (!body) return "";
  // Replace raw ISO timestamp strings like "2026-07-16 at 20:30" with cleaner formatted dates
  return body.replace(/(\d{4}-\d{2}-\d{2})\s+at\s+(\d{2}):(\d{2})/g, (_, dateStr, hh, mm) => {
    try {
      const d = new Date(`${dateStr}T${hh}:${mm}:00`);
      if (isNaN(d.getTime())) return `${dateStr} at ${hh}:${mm}`;
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const monthName = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${dayName}, ${monthName} at ${timeStr}`;
    } catch {
      return `${dateStr} at ${hh}:${mm}`;
    }
  });
}

function getNotificationCategory(title: string, type: string, data?: unknown) {
  const text = `${title} ${type}`.toLowerCase();
  if (type === "teleconsult" || text.includes("teleconsult") || text.includes("video")) {
    const payload = data as { roomId?: unknown } | null | undefined;
    const roomId =
      payload && typeof payload.roomId === "string" ? payload.roomId : null;
    return {
      category: "appointments",
      icon: Video,
      bg: "bg-violet-50 text-violet-700 border-violet-100",
      link: roomId ? `/patient/teleconsult/${roomId}` : "/patient/appointments",
    };
  }
  if (text.includes("appoint") || text.includes("visit") || text.includes("doctor")) {
    return {
      category: "appointments",
      icon: Calendar,
      bg: "bg-sky-50 text-sky-700 border-sky-100",
      link: "/patient/appointments",
    };
  }
  if (text.includes("med") || text.includes("prescript") || text.includes("dose") || text.includes("refill")) {
    return {
      category: "medications",
      icon: Pill,
      bg: "bg-emerald-50 text-emerald-700 border-emerald-100",
      link: "/patient/medications",
    };
  }
  if (text.includes("lab") || text.includes("test") || text.includes("scan") || text.includes("result")) {
    return {
      category: "labs",
      icon: FlaskConical,
      bg: "bg-purple-50 text-purple-700 border-purple-100",
      link: "/patient/records",
    };
  }
  if (text.includes("claim") || text.includes("insurance") || text.includes("policy")) {
    return {
      category: "insurance",
      icon: ShieldCheck,
      bg: "bg-amber-50 text-amber-800 border-amber-100",
      link: "/patient/insurance/claims",
    };
  }
  return {
    category: "general",
    icon: Bell,
    bg: "bg-slate-50 text-slate-700 border-slate-200",
    link: null,
  };
}

export default function NotificationsPage() {
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "appointments" | "medications">("all");
  const [search, setSearch] = useState("");

  const rawNotifications = query.data?.notifications ?? [];

  const { unreadCount, appointmentCount, medCount } = useMemo(() => {
    let unread = 0;
    let appointments = 0;
    let meds = 0;

    for (const n of rawNotifications) {
      if (!n.read) unread++;
      const cat = getNotificationCategory(n.title, n.type).category;
      if (cat === "appointments") appointments++;
      if (cat === "medications") meds++;
    }

    return { unreadCount: unread, appointmentCount: appointments, medCount: meds };
  }, [rawNotifications]);

  const filteredNotifications = useMemo(() => {
    let list = rawNotifications;
    if (activeFilter === "unread") {
      list = list.filter((n) => !n.read);
    } else if (activeFilter === "appointments") {
      list = list.filter((n) => getNotificationCategory(n.title, n.type).category === "appointments");
    } else if (activeFilter === "medications") {
      list = list.filter((n) => getNotificationCategory(n.title, n.type).category === "medications");
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.body || "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [rawNotifications, activeFilter, search]);

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<Bell size={13} aria-hidden />}
        kicker="Live Care Alerts & Inbox"
        title="Activity Notifications & Alerts"
        description="Stay updated on clinic visits, prescription refills, test results, and healthcare communications in real time."
        status={
          unreadCount > 0 ? (
            <HeroStatusPill label={`${unreadCount} unread`} tone="warn" />
          ) : (
            <HeroStatusPill label="All caught up" tone="success" />
          )
        }
        actions={
          <>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className={heroSecondaryAction}
              >
                <CheckCheck size={14} aria-hidden />
                {markAllRead.isPending ? "Marking…" : "Mark All Read"}
              </button>
            ) : null}
            <Link href="/patient/appointments" className={heroPrimaryAction}>
              <Calendar size={14} aria-hidden />
              My Schedule
            </Link>
          </>
        }
        footer={
          <>
            <span>Total Alerts · {rawNotifications.length}</span>
            <span>Unread Alerts · {unreadCount}</span>
            <span>Visits &amp; Queues · {appointmentCount}</span>
            <span>Medications · {medCount}</span>
          </>
        }
      />

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Filter Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0",
              activeFilter === "all"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            All ({rawNotifications.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("unread")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
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

          <button
            type="button"
            onClick={() => setActiveFilter("appointments")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0",
              activeFilter === "appointments"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Appointments ({appointmentCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("medications")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0",
              activeFilter === "medications"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Medications ({medCount})
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
            placeholder="Search alerts by title or description..."
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

      {/* ── 3. Notifications Feed ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {query.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <CheckCheck size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {search ? "No notifications match your search" : "You're all caught up"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                {search
                  ? `No alerts found for "${search}". Try clearing search.`
                  : "There are no unread notifications or action items for your health account right now."}
              </p>
            </div>
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-1 px-4 py-1.5 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 transition-colors"
              >
                Clear Search
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredNotifications.map((n) => {
              const meta = getNotificationCategory(n.title, n.type, n.data);
              const CategoryIcon = meta.icon;
              const formattedBody = cleanNotificationBody(n.body);

              return (
                <article
                  key={n.id}
                  className={cn(
                    "group rounded-2xl border bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex items-start sm:items-center justify-between gap-4",
                    !n.read
                      ? "border-sky-300 bg-gradient-to-r from-sky-50/40 via-white to-white ring-1 ring-sky-400/20"
                      : "border-slate-200/90",
                  )}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {/* Category Icon Badge */}
                    <div
                      className={cn(
                        "h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform mt-0.5 sm:mt-0",
                        meta.bg,
                      )}
                    >
                      <CategoryIcon size={20} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-sky-700 transition-colors truncate">
                          {n.title}
                        </h3>

                        {!n.read ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-600 text-white shadow-2xs">
                            New
                          </span>
                        ) : (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                            Read
                          </span>
                        )}
                      </div>

                      {formattedBody ? (
                        <p className="text-xs text-slate-600 font-medium mt-0.5 leading-relaxed">
                          {formattedBody}
                        </p>
                      ) : null}

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-medium">
                        <Clock size={11} />
                        <span>{formatRelative(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Mark read & Jump to link) */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    {!n.read ? (
                      <button
                        type="button"
                        onClick={() => markRead.mutate(n.id)}
                        disabled={markRead.isPending}
                        title="Mark as read"
                        className="p-2 rounded-xl text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Check size={16} />
                      </button>
                    ) : null}

                    {meta.link ? (
                      <Link
                        href={meta.link}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-colors"
                      >
                        <span>View</span>
                        <ChevronRight size={13} />
                      </Link>
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
