"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Inbox,
  Send,
  ChevronRight,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useState, useMemo } from "react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Drawer } from "@/portal/components/ui/Modal";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  PRIMARY_BTN,
  RowAccent,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface ConvRow {
  id: string;
  patientId: string;
  patient: { id: string; userId: string; name: string; photo: string | null };
  lastMessageAt: string;
  lastMessagePreview: string | null;
  doctorUnread: number;
  status: "open" | "closed";
}

type Filter = "all" | "unread" | "open" | "closed";

export default function MessagesInboxPage() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-messages", "conversations", "inbox"],
    queryFn: () =>
      api<{ conversations: ConvRow[]; totalUnread: number }>(
        `/doctor-messages/conversations?limit=100`
      ),
  });

  // Recent patients for quick-selection on empty landing view
  const { data: recentPatientsData } = useQuery({
    queryKey: ["messages", "recent-patients-quick"],
    queryFn: () =>
      api<{
        patients: Array<{
          patient: { id: string; nic?: string | null; dob?: string | null; sex?: string | null; photo?: string | null };
          user: { id: string; name: string };
        }>;
      }>("/doctor/search-patients?recent=1&limit=5"),
  });

  const startConversation = useMutation({
    mutationFn: async (patientId: string) => {
      const res = await api<{ conversation: { id: string } }>(
        "/doctor-messages/conversations",
        {
          method: "POST",
          json: { patientId },
        }
      );
      return res.conversation;
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["doctor-messages", "conversations"] });
      setIsCreating(false);
      router.push(`/portal/messages/${conv.id}`);
    },
    onError: (err: unknown) => {
      toast.error(t("toast.error"), err instanceof Error ? err.message : "Failed to open conversation");
    },
  });

  const allConversations = data?.conversations ?? [];
  const totalUnread = data?.totalUnread ?? 0;
  const [now] = useState(() => Date.now());

  const counts = useMemo(() => {
    const unreadThreads = allConversations.filter((c) => c.doctorUnread > 0).length;
    const open = allConversations.filter((c) => c.status !== "closed").length;
    const today = allConversations.filter((c) => now - Date.parse(c.lastMessageAt) < 86_400_000).length;
    return { unreadThreads, open, closed: allConversations.length - open, today };
  }, [allConversations, now]);

  const rows = useMemo(() => {
    let list = allConversations;
    if (filter === "unread") list = list.filter((c) => c.doctorUnread > 0);
    if (filter === "open") list = list.filter((c) => c.status !== "closed");
    if (filter === "closed") list = list.filter((c) => c.status === "closed");
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (c) =>
        c.patient.name.toLowerCase().includes(term) ||
        (c.lastMessagePreview ?? "").toLowerCase().includes(term)
    );
  }, [allConversations, filter, q]);

  const recentList = recentPatientsData?.patients ?? [];
  const filtersOn = q.trim() !== "" || filter !== "all";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<MessageSquare size={13} aria-hidden />}
          kicker="Patient inbox"
          kickerMeta={`${counts.today} active today`}
          title={
            <>
              Messages &amp;{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                consults
              </span>
            </>
          }
          description="Answer treatment questions, review follow-up progress and coordinate care over secure, encrypted threads."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                End-to-end encrypted
              </span>
              <span className={HERO_CHIP}>
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Real-time delivery
              </span>
              {totalUnread > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilter("unread")}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-300/30 bg-violet-400/15 px-3 py-1.5 text-xs font-semibold text-violet-100 transition-colors hover:bg-violet-400/25"
                >
                  <MessageSquare size={12} aria-hidden />
                  {totalUnread} unread
                </button>
              ) : null}
            </>
          }
          actions={
            <button type="button" onClick={() => setIsCreating(true)} className={HERO_PRIMARY}>
              <Plus size={15} strokeWidth={2.5} className="text-sky-600" aria-hidden />
              New conversation
            </button>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="All threads"
            icon={<MessageSquare size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : String(allConversations.length)}
            sub="Patient conversations"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <StatTile
            label="Unread"
            icon={<Inbox size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(totalUnread)}
            unit={totalUnread === 1 ? "message" : "messages"}
            sub={counts.unreadThreads > 0 ? `Across ${counts.unreadThreads} thread${counts.unreadThreads === 1 ? "" : "s"}` : "Inbox is clear"}
            badge={totalUnread > 0 ? { text: "New", tone: "bg-violet-50 text-violet-700" } : undefined}
            pulse={totalUnread > 0}
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
          />
          <StatTile
            label="Open"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(counts.open)}
            sub="Accepting replies"
            progress={allConversations.length > 0 ? Math.round((counts.open / allConversations.length) * 100) : null}
            active={filter === "open"}
            onClick={() => setFilter("open")}
          />
          <StatTile
            label="Closed"
            icon={<Lock size={16} />}
            tone="bg-slate-100 text-slate-600"
            value={String(counts.closed)}
            sub="Archived threads"
            active={filter === "closed"}
            onClick={() => setFilter("closed")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Inbox ────────────────────────────────────────────────────── */}
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="msg-inbox">
          <PanelHeader
            id="msg-inbox"
            icon={<Inbox size={16} />}
            tone="bg-violet-50 text-violet-600"
            title="Inbox"
            caption={isLoading ? "Loading conversations…" : `${rows.length} of ${allConversations.length} shown`}
          />

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PanelSearch
              value={q}
              onChange={setQ}
              placeholder="Search patient or message…"
              ariaLabel="Search conversations"
              className="lg:max-w-xs"
            />
            <Segmented<Filter>
              ariaLabel="Filter conversations"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: allConversations.length },
                { value: "unread", label: "Unread", count: counts.unreadThreads },
                { value: "open", label: "Open", count: counts.open },
                { value: "closed", label: "Closed", count: counts.closed },
              ]}
            />
          </div>

          {isLoading ? (
            <div className="mt-5 space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyBlock
              icon={<MessageSquare size={19} />}
              title={filtersOn ? "No matching conversations" : "No conversations yet"}
              body={
                filtersOn
                  ? "Nothing matches these filters. Try another name or reset the filter."
                  : "Patient questions and refill requests land here. Start a thread with anyone on your panel."
              }
              actions={
                filtersOn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      setFilter("all");
                    }}
                    className={SECONDARY_BTN}
                  >
                    Reset filters
                  </button>
                ) : (
                  <button type="button" onClick={() => setIsCreating(true)} className={PRIMARY_BTN}>
                    <Plus size={13} strokeWidth={2.5} />
                    New conversation
                  </button>
                )
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {rows.map((c) => {
                const isUnread = c.doctorUnread > 0;
                const closed = c.status === "closed";
                return (
                  <li key={c.id}>
                    <Link
                      href={`/portal/messages/${c.id}`}
                      className={cn(LIST_ROW, "sm:flex-row sm:items-center", isUnread && "bg-violet-50/40")}
                    >
                      <RowAccent className={isUnread ? "bg-violet-500" : closed ? "bg-slate-300" : "bg-emerald-500"} />
                      <span className="flex min-w-0 flex-1 items-center gap-3.5 pl-1.5">
                        <span className="relative shrink-0">
                          <Avatar name={c.patient.name} src={c.patient.photo ?? undefined} size="md" className="h-10 w-10" />
                          {isUnread ? (
                            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-violet-600" aria-hidden />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  "truncate text-sm text-slate-900 transition-colors group-hover:text-sky-700",
                                  isUnread ? "font-semibold" : "font-medium",
                                )}
                              >
                                {c.patient.name}
                              </span>
                              {closed ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500">
                                  <Lock size={9} />
                                  {t("messages.closed")}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-[11px] tabular-nums",
                                isUnread ? "font-semibold text-violet-600" : "text-slate-400",
                              )}
                            >
                              {relativeTime(c.lastMessageAt)}
                            </span>
                          </span>
                          <span className={cn("mt-0.5 block truncate text-xs", isUnread ? "text-slate-700" : "text-slate-500")}>
                            {c.lastMessagePreview ?? "No messages in thread yet"}
                          </span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-2 sm:flex">
                        {isUnread ? (
                          <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold text-white">
                            {c.doctorUnread}
                          </span>
                        ) : null}
                        <ChevronRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Start a thread ───────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Start a conversation">
          <section className={PANEL} aria-labelledby="msg-start">
            <PanelHeader
              id="msg-start"
              icon={<Send size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Message a patient"
              caption="Opens or resumes their thread"
            />
            <div className="mt-4">
              <PatientCombobox
                value={null}
                onChange={(p) => {
                  if (p) startConversation.mutate(p.id);
                }}
                disabled={startConversation.isPending}
              />
            </div>
            {recentList.length > 0 ? (
              <>
                <p className="mt-5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Recent patients
                </p>
                <ul className="mt-2 flex flex-col gap-0.5">
                  {recentList.map((item) => (
                    <li key={item.patient.id}>
                      <button
                        type="button"
                        onClick={() => startConversation.mutate(item.patient.id)}
                        disabled={startConversation.isPending}
                        className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Avatar name={item.user.name} src={item.patient.photo ?? undefined} size="sm" className="h-8 w-8" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-900 group-hover:text-sky-700">
                            {item.user.name}
                          </span>
                          {item.patient.nic ? (
                            <span className="block truncate font-mono text-[11px] text-slate-400">{item.patient.nic}</span>
                          ) : null}
                        </span>
                        <ArrowRight size={14} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-4 text-xs leading-relaxed text-slate-600 ring-1 ring-inset ring-emerald-600/10">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
              <ShieldCheck size={16} aria-hidden />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-slate-900">Private by design</span>
              Threads are encrypted in transit and at rest, and only you and the patient can read them.
            </span>
          </div>
        </aside>
      </div>

      {/* ── Start New Conversation Drawer ─────────────────────────────── */}
      <Drawer
        open={isCreating}
        onClose={() => setIsCreating(false)}
        title="Start New Patient Conversation"
        subtitle="Select a registered patient to initiate an encrypted telehealth thread"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Search Patient
            </label>
            <PatientCombobox
              value={null}
              onChange={(p) => {
                if (p) startConversation.mutate(p.id);
              }}
              disabled={startConversation.isPending}
            />
          </div>

          {recentList.length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent Patients:
              </span>
              <div className="flex flex-col gap-1.5">
                {recentList.map((item) => (
                  <button
                    key={item.patient.id}
                    type="button"
                    onClick={() => startConversation.mutate(item.patient.id)}
                    disabled={startConversation.isPending}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-sky-50 hover:border-sky-300 border border-slate-200 text-xs font-bold text-slate-700 hover:text-sky-800 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={item.user.name} size="sm" />
                      <div className="text-left">
                        <span className="block font-bold text-slate-900">{item.user.name}</span>
                        {item.patient.nic && (
                          <span className="text-[11px] text-slate-400 font-normal">
                            NIC: {item.patient.nic}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
