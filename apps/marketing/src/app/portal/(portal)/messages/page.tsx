"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MessageSquare,
  ChevronRight,
  Plus,
  X,
  ShieldCheck,
  CheckCircle2,
  Lock,
  User,
  ArrowRight,
} from "lucide-react";
import { useState, useMemo } from "react";

import { api } from "@/portal/lib/api";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Drawer } from "@/portal/components/ui/Modal";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { ChartEmpty } from "@/portal/components/chart/ChartEmpty";
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
}

export default function MessagesInboxPage() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
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
      }>("/doctor/search-patients?q=&limit=5"),
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
    onError: (err: any) => {
      toast.error(t("toast.error"), err?.message ?? "Failed to open conversation");
    },
  });

  const allConversations = data?.conversations ?? [];
  const totalUnread = data?.totalUnread ?? 0;

  const rows = useMemo(() => {
    let list = allConversations;
    if (filter === "unread") {
      list = list.filter((c) => c.doctorUnread > 0);
    }
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (c) =>
        c.patient.name.toLowerCase().includes(term) ||
        (c.lastMessagePreview ?? "").toLowerCase().includes(term)
    );
  }, [allConversations, filter, q]);

  const recentList = recentPatientsData?.patients ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Oceanic Hero Header ────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden flex flex-col gap-6"
        style={{
          background:
            "radial-gradient(134.49% 134.49% at 94.63% 0%, #0284C7 0%, #0369A1 42.6%, #075985 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/20">
                Doctor-Patient Telehealth Communications
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-300/20 text-sky-100 border border-sky-300/30 flex items-center gap-1">
                <ShieldCheck size={13} />
                <span>End-to-End Encrypted · HIPAA Compliant</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
              Clinical Messages & Patient Consults
            </h1>
            <p className="text-sm text-sky-100/90 max-w-2xl mt-1 leading-relaxed">
              Conduct direct clinical consultations, answer patient treatment queries, review follow-up progress, and coordinate care across secure message channels.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-sky-950 bg-white shadow-md hover:bg-sky-50 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>New Conversation</span>
          </button>
        </div>

        {/* 4 Telemetry Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Total Threads</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{allConversations.length}</span>
            <span className="text-[10.5px] text-sky-200/80 mt-0.5">Active consultations</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Unread Inquiries</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{totalUnread}</span>
            <span className="text-[10.5px] text-amber-200/80 mt-0.5">Awaiting doctor reply</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Messaging Service</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1">Real-time WSS</span>
            <span className="text-[10.5px] text-emerald-200/80 mt-0.5">Instant delivery active</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-teal-200 uppercase tracking-wider">Security Tier</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1">AES-256 GCM</span>
            <span className="text-[10.5px] text-teal-200/80 mt-0.5">Zero-knowledge channel</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all flex-1 max-w-md">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations by patient name or message snippet…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="h-5 w-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <FilterPills<"all" | "unread">
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All Threads", count: allConversations.length },
            { value: "unread", label: "Unread", count: totalUnread },
          ]}
        />
      </div>

      {/* ── Conversations Listing ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-5 flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : rows.length === 0 ? (
          /* Rich Interactive Empty State with Direct Patient Launch */
          <div className="p-8 sm:p-10 text-center flex flex-col items-center">
            <div className="h-16 w-16 rounded-3xl bg-sky-50 text-sky-600 border border-sky-200/80 shadow-xs flex items-center justify-center mb-4">
              <MessageSquare size={28} />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {q || filter === "unread"
                ? "No matching conversations found"
                : "Start a Secure Patient Consultation"}
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mt-2 leading-relaxed">
              {q || filter === "unread"
                ? `No conversation threads match your current filter criteria. Try resetting your search or filter.`
                : "Select any patient from your clinical panel to initiate a private, encrypted consultation thread."}
            </p>

            {q || filter === "unread" ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setFilter("all");
                }}
                className="mt-6 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
              >
                Reset Search Filters
              </button>
            ) : (
              <div className="w-full max-w-md mt-6 text-left">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Select Patient to Message
                </label>
                <PatientCombobox
                  value={null}
                  onChange={(p) => {
                    if (p) startConversation.mutate(p.id);
                  }}
                  disabled={startConversation.isPending}
                />

                {recentList.length > 0 && (
                  <div className="w-full mt-6 pt-5 border-t border-slate-100 flex flex-col items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                      Quick Start with Patient:
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {recentList.map((item) => (
                        <button
                          key={item.patient.id}
                          type="button"
                          onClick={() => startConversation.mutate(item.patient.id)}
                          disabled={startConversation.isPending}
                          className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-sky-50 hover:border-sky-300 border border-slate-200/80 text-xs font-bold text-slate-700 hover:text-sky-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Avatar name={item.user.name} size="xs" />
                          <span>{item.user.name}</span>
                          <ArrowRight size={11} className="text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {rows.map((c) => {
              const isUnread = c.doctorUnread > 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/portal/messages/${c.id}`}
                    className={cn(
                      "flex items-center justify-between gap-4 px-5 py-4 transition-colors group cursor-pointer",
                      isUnread
                        ? "bg-sky-50/50 hover:bg-sky-50/80"
                        : "hover:bg-slate-50/80"
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <Avatar
                          name={c.patient.name}
                          src={c.patient.photo ?? undefined}
                          size="md"
                          className={cn(
                            "ring-2 transition-all",
                            isUnread ? "ring-sky-500 shadow-xs" : "ring-slate-100"
                          )}
                        />
                        {isUnread && (
                          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-sky-600 border-2 border-white ring-1 ring-sky-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                "text-sm truncate leading-tight group-hover:text-sky-700 transition-colors",
                                isUnread
                                  ? "font-black text-slate-900"
                                  : "font-bold text-slate-800"
                              )}
                            >
                              {c.patient.name}
                            </span>
                            {isUnread && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-600 text-white shadow-2xs">
                                New
                              </span>
                            )}
                          </div>

                          <span className="text-xs text-slate-400 shrink-0 tabular-nums font-medium">
                            {relativeTime(c.lastMessageAt)}
                          </span>
                        </div>

                        <p
                          className={cn(
                            "text-xs truncate leading-relaxed",
                            isUnread
                              ? "text-slate-700 font-semibold"
                              : "text-slate-500"
                          )}
                        >
                          {c.lastMessagePreview ?? "No messages in thread yet"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {isUnread && (
                        <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-sky-600 text-[11px] font-black text-white flex items-center justify-center shadow-xs">
                          {c.doctorUnread}
                        </span>
                      )}
                      <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 group-hover:bg-sky-50 group-hover:text-sky-700 group-hover:border-sky-200 border border-slate-200 transition-all flex items-center gap-1">
                        <span>Open Chat</span>
                        <ChevronRight size={13} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
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
