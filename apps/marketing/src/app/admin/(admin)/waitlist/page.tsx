"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  MailCheck,
  Megaphone,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  RowAccent,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { humanize, ROW_BTN_APPROVE, ROW_BTN_DANGER } from "@/portal/components/admin/AdminDirectory";
import { Pill } from "@/portal/components/ui/Pill";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  id: string;
  email: string;
  role: string;
  source: string | null;
  invitedAt: string | null;
  invitedSlot: string | null;
  createdAt: string;
};

const STATUSES = ["all", "pending", "invited"] as const;
type StatusKey = (typeof STATUSES)[number];

export default function AdminWaitlistPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusKey>("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: adminQk.waitlist(status),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/waitlist?status=${status}&limit=300`),
  });

  // Per-bucket counts for the stat strip + segmented control. The bucket for
  // the active filter shares its query key with the list above, so it is free.
  const bucketQueries = useQueries({
    queries: STATUSES.map((s) => ({
      queryKey: adminQk.waitlist(s),
      queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/waitlist?status=${s}&limit=300`),
      staleTime: 30_000,
    })),
  });
  const buckets = useMemo(() => {
    const m = {} as Record<StatusKey, { count?: number; items: Row[] }>;
    STATUSES.forEach((s, i) => {
      const d = bucketQueries[i].data;
      m[s] = { count: d?.total ?? d?.items.length, items: d?.items ?? [] };
    });
    return m;
  }, [bucketQueries]);

  const total = buckets.all.count;
  const pending = buckets.pending.count;
  const invited = buckets.invited.count;
  const invitedPct = total ? Math.round(((invited ?? 0) / total) * 100) : null;
  const [now] = useState(() => Date.now());
  const newThisWeek = useMemo(() => {
    const weekAgo = now - 7 * 86_400_000;
    return buckets.all.items.filter((w) => Date.parse(w.createdAt) >= weekAgo).length;
  }, [buckets.all.items, now]);

  const invite = useMutation({
    mutationFn: (id: string) => adminApi(`/admin/waitlist/${id}/invite`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Marked as invited");
      qc.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi(`/admin/waitlist/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<MailCheck size={13} aria-hidden />}
          kicker="Catalog"
          kickerMeta={total != null ? `${total.toLocaleString()} signups` : "Marketing waitlist"}
          title={
            <>
              Marketing{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                waitlist
              </span>
            </>
          }
          description={
            pending != null && pending > 0
              ? `${pending} ${pending === 1 ? "person is" : "people are"} waiting for an invite — work through the queue or prune stale entries.`
              : "Early-access signups from the marketing site. Invite people onto the platform or remove stale entries."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <Sparkles size={12} className="text-emerald-300" aria-hidden />
                Early-access pipeline
              </span>
              {(pending ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <Send size={12} aria-hidden />
                  {pending} awaiting invite
                </span>
              ) : null}
            </>
          }
          actions={
            <button type="button" onClick={() => refetch()} disabled={isFetching} className={HERO_GHOST}>
              <RefreshCw size={15} className={cn(isFetching && "animate-spin")} aria-hidden />
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Total signups"
            icon={<MailCheck size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={total != null ? total.toLocaleString() : "…"}
            sub="Everyone on the list"
            active={status === "all"}
            onClick={() => setStatus("all")}
          />
          <StatTile
            label="Pending"
            icon={<UserPlus size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={pending != null ? String(pending) : "…"}
            sub={pending ? "Awaiting an invite" : "Queue is clear"}
            pulse={(pending ?? 0) > 0}
            badge={pending ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={status === "pending"}
            onClick={() => setStatus("pending")}
          />
          <StatTile
            label="Invited"
            icon={<Send size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={invited != null ? String(invited) : "…"}
            sub="Invite sent"
            progress={invitedPct}
            active={status === "invited"}
            onClick={() => setStatus("invited")}
          />
          <StatTile
            label="New this week"
            icon={<CalendarPlus size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={buckets.all.items.length ? String(newThisWeek) : "…"}
            sub="Signups in the last 7 days"
          />
        </HeroOverlap>
      </div>

      {/* ── Waitlist ───────────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="wl-list">
        <PanelHeader
          id="wl-list"
          icon={<MailCheck size={16} />}
          tone="bg-violet-50 text-violet-600"
          title={status === "all" ? "All signups" : `${humanize(status)} signups`}
          caption={
            isLoading || !data
              ? "Loading waitlist…"
              : `${data.items.length} of ${data.total.toLocaleString()} shown`
          }
          action={
            <Segmented<StatusKey>
              ariaLabel="Signup status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "All", count: total ?? undefined },
                { value: "pending", label: "Pending", count: pending ?? undefined },
                { value: "invited", label: "Invited", count: invited ?? undefined },
              ]}
            />
          }
        />

        {isLoading || !data ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyBlock
            icon={<MailCheck size={19} />}
            title={status === "all" ? "No signups yet" : `No ${status} signups`}
            body={
              status === "pending"
                ? "Everyone on the waitlist has been invited."
                : "Signups from the marketing site will land here."
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {data.items.map((w) => {
              const isInvited = !!w.invitedAt;
              return (
                <li key={w.id} className={LIST_ROW}>
                  <RowAccent className={isInvited ? "bg-emerald-500" : "bg-amber-400"} />
                  <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                        isInvited ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600",
                      )}
                    >
                      <MailCheck size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">{w.email}</span>
                        <Pill>{humanize(w.role)}</Pill>
                        {isInvited ? (
                          <Pill tone="success">Invited</Pill>
                        ) : (
                          <Pill tone="warn">Pending</Pill>
                        )}
                      </span>
                      <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarPlus size={11} aria-hidden />
                          Joined {new Date(w.createdAt).toLocaleDateString()}
                        </span>
                        {w.source ? (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Megaphone size={11} aria-hidden />
                            {w.source}
                          </span>
                        ) : null}
                        {w.invitedAt ? (
                          <span className="inline-flex items-center gap-1">
                            <Send size={11} aria-hidden />
                            Invited {new Date(w.invitedAt).toLocaleDateString()}
                            {w.invitedSlot ? ` · slot ${w.invitedSlot}` : ""}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                    {!isInvited ? (
                      <button
                        type="button"
                        onClick={() => invite.mutate(w.id)}
                        disabled={invite.isPending}
                        className={ROW_BTN_APPROVE}
                      >
                        <Send size={14} aria-hidden />
                        Invite
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${w.email} from the waitlist?`)) remove.mutate(w.id);
                      }}
                      disabled={remove.isPending}
                      title="Remove from waitlist"
                      aria-label={`Remove ${w.email}`}
                      className={cn(ROW_BTN_DANGER, "px-2")}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
