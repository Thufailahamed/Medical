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
  Settings2,
  ShieldCheck,
  Video,
} from "lucide-react";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/patient/hooks";
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
  QuickToolsPanel,
  RowAccent,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

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
      tile: "bg-violet-50 text-violet-600",
      link: roomId ? `/patient/teleconsult/${roomId}` : "/patient/appointments",
    };
  }
  if (text.includes("appoint") || text.includes("visit") || text.includes("doctor")) {
    return {
      category: "appointments",
      icon: Calendar,
      tile: "bg-sky-50 text-sky-600",
      link: "/patient/appointments",
    };
  }
  if (text.includes("med") || text.includes("prescript") || text.includes("dose") || text.includes("refill")) {
    return {
      category: "medications",
      icon: Pill,
      tile: "bg-emerald-50 text-emerald-600",
      link: "/patient/medications",
    };
  }
  if (text.includes("lab") || text.includes("test") || text.includes("scan") || text.includes("result")) {
    return {
      category: "labs",
      icon: FlaskConical,
      tile: "bg-violet-50 text-violet-600",
      link: "/patient/records",
    };
  }
  if (text.includes("claim") || text.includes("insurance") || text.includes("policy")) {
    return {
      category: "insurance",
      icon: ShieldCheck,
      tile: "bg-amber-50 text-amber-600",
      link: "/patient/insurance/claims",
    };
  }
  return {
    category: "general",
    icon: Bell,
    tile: "bg-slate-100 text-slate-500",
    link: null,
  };
}

export default function NotificationsPage() {
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "appointments" | "medications">("all");
  const [search, setSearch] = useState("");

  const rawNotifications = useMemo(
    () => query.data?.notifications ?? [],
    [query.data?.notifications],
  );

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
    <PatientPage>
      <PatientHero
        kickerIcon={<Bell size={13} aria-hidden />}
        kicker="Inbox"
        kickerMeta="Live care alerts"
        title={
          <>
            Notifications <HeroAccent>&amp; alerts</HeroAccent>
          </>
        }
        description="Stay updated on clinic visits, prescription refills, test results, and healthcare communications in real time."
        chips={
          <>
            <span className={HERO_CHIP}>{rawNotifications.length} alerts</span>
            {unreadCount > 0 ? (
              <span className={HERO_CHIP}>
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                {unreadCount} unread
              </span>
            ) : (
              <span className={HERO_CHIP}>
                <CheckCheck size={12} className="text-emerald-300" />
                All caught up
              </span>
            )}
            <span className={HERO_CHIP}>
              <Calendar size={12} className="text-sky-300" />
              {appointmentCount} visits
            </span>
            <span className={HERO_CHIP}>
              <Pill size={12} className="text-emerald-300" />
              {medCount} meds
            </span>
          </>
        }
        actions={
          <>
            <Link href="/patient/notifications/preferences" className={HERO_GHOST}>
              <Settings2 size={13} /> Preferences
            </Link>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className={HERO_PRIMARY}
              >
                <CheckCheck size={14} className="text-sky-600" />
                {markAllRead.isPending ? "Marking…" : "Mark all read"}
              </button>
            ) : null}
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Bell size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="All alerts"
          value={String(rawNotifications.length)}
          sub="Notification history"
          active={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
        />
        <StatTile
          icon={<CheckCheck size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Unread"
          value={String(unreadCount)}
          sub={unreadCount > 0 ? "Needs attention" : "All caught up"}
          pulse={unreadCount > 0}
          active={activeFilter === "unread"}
          onClick={() => setActiveFilter("unread")}
        />
        <StatTile
          icon={<Calendar size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Appointments"
          value={String(appointmentCount)}
          sub="Visits & queues"
          active={activeFilter === "appointments"}
          onClick={() => setActiveFilter("appointments")}
        />
        <StatTile
          icon={<Pill size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Medications"
          value={String(medCount)}
          sub="Refills & doses"
          active={activeFilter === "medications"}
          onClick={() => setActiveFilter("medications")}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<Bell size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Activity feed"
              caption={`${filteredNotifications.length} of ${rawNotifications.length} alerts`}
              action={
                unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                ) : undefined
              }
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Segmented
                ariaLabel="Notification filters"
                options={[
                  { value: "all", label: "All", count: rawNotifications.length },
                  { value: "unread", label: "Unread", count: unreadCount },
                  { value: "appointments", label: "Appts", count: appointmentCount },
                  { value: "medications", label: "Meds", count: medCount },
                ]}
                value={activeFilter}
                onChange={(v) =>
                  setActiveFilter(v as "all" | "unread" | "appointments" | "medications")
                }
              />
              <PanelSearch
                value={search}
                onChange={setSearch}
                placeholder="Search alerts by title or description…"
                className="flex-1 sm:max-w-xs"
              />
            </div>

            {query.isLoading ? (
              <div className="mt-4 flex flex-col gap-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <EmptyBlock
                icon={<CheckCheck size={19} />}
                title={search ? "No notifications match your search" : "You're all caught up"}
                body={
                  search
                    ? `No alerts found for "${search}". Try clearing search.`
                    : "There are no unread notifications or action items for your health account right now."
                }
                actions={
                  search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="inline-flex h-9 items-center rounded-lg bg-slate-100 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                    >
                      Clear search
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {filteredNotifications.map((n) => {
                  const meta = getNotificationCategory(n.title, n.type, n.data);
                  const CategoryIcon = meta.icon;
                  const formattedBody = cleanNotificationBody(n.body);

                  return (
                    <li key={n.id}>
                      <article
                        className={cn(
                          LIST_ROW,
                          "group",
                          !n.read && "bg-sky-50/40 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.25)]",
                        )}
                      >
                        <RowAccent className={!n.read ? "bg-sky-500" : "bg-slate-200"} />
                        <div
                          className={cn(
                            "grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105",
                            meta.tile,
                          )}
                          aria-hidden
                        >
                          <CategoryIcon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-sky-700">
                              {n.title}
                            </h3>
                            {!n.read ? (
                              <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                                New
                              </span>
                            ) : null}
                          </div>
                          {formattedBody ? (
                            <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">
                              {formattedBody}
                            </p>
                          ) : null}
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                            <Clock size={11} />
                            <span>{formatRelative(n.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                          {!n.read ? (
                            <button
                              type="button"
                              onClick={() => markRead.mutate(n.id)}
                              disabled={markRead.isPending}
                              title="Mark as read"
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                            >
                              <Check size={16} />
                            </button>
                          ) : null}
                          {meta.link ? (
                            <Link
                              href={meta.link}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
                            >
                              View <ChevronRight size={13} aria-hidden />
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<Settings2 size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Delivery preferences"
              caption="Channels, topics & quiet hours."
            />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Control push, email and SMS delivery — and pause non-urgent alerts
              during quiet hours.
            </p>
            <Link
              href="/patient/notifications/preferences"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <Settings2 size={14} /> Manage preferences
            </Link>
          </section>

          <QuickToolsPanel
            id="notif-tools"
            title="Tools"
            tools={[
              {
                icon: Calendar,
                label: "Appointments",
                hint: "Schedule",
                href: "/patient/appointments",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: Pill,
                label: "Medications",
                hint: "Refills",
                href: "/patient/medications",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: ShieldCheck,
                label: "Claims",
                hint: "Insurance",
                href: "/patient/insurance/claims",
                tone: "from-amber-500 to-orange-500 shadow-amber-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}
