"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Mail,
  Megaphone,
  Phone,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  XCircle,
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
import { humanize, ROW_BTN_APPROVE, ROW_BTN_QUIET } from "@/portal/components/admin/AdminDirectory";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Pill } from "@/portal/components/ui/Pill";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  id: string;
  contactName: string;
  contactRole: string | null;
  email: string;
  phone: string;
  clinicName: string | null;
  specialty: string | null;
  status: string;
  message: string | null;
  createdAt: string;
};

const STATUSES = ["new", "contacted", "closed"] as const;
type StatusKey = (typeof STATUSES)[number];

const STATUS_TONE: Record<string, "brand" | "success" | "neutral"> = {
  new: "brand",
  contacted: "success",
  closed: "neutral",
};

const STATUS_TILE: Record<string, string> = {
  new: "bg-violet-50 text-violet-600",
  contacted: "bg-sky-50 text-sky-600",
  closed: "bg-slate-100 text-slate-600",
};

const STATUS_RAIL: Record<string, string> = {
  new: "bg-violet-500",
  contacted: "bg-sky-500",
  closed: "bg-slate-300",
};

export default function AdminDemoRequestsPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const paramStatus = params.get("status") ?? undefined;
  const [status, setStatus] = useState<string | undefined>(paramStatus);
  const [prevParamStatus, setPrevParamStatus] = useState(paramStatus);

  // Keep the filter in sync when the URL param changes (e.g. deep links).
  if (paramStatus !== prevParamStatus) {
    setPrevParamStatus(paramStatus);
    setStatus(paramStatus);
  }

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: adminQk.demoRequests(status),
    queryFn: () =>
      adminApi<{ items: Row[]; total: number }>(
        status
          ? `/admin/demo-requests?status=${status}&limit=200`
          : `/admin/demo-requests?limit=200`,
      ),
  });

  // Per-bucket counts for the stat strip + segmented control. The bucket for
  // the active status shares its query key with the list above, so it is free.
  const bucketQueries = useQueries({
    queries: STATUSES.map((s) => ({
      queryKey: adminQk.demoRequests(s),
      queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/demo-requests?status=${s}&limit=200`),
      staleTime: 30_000,
    })),
  });
  const buckets = useMemo(() => {
    const m = {} as Record<StatusKey, number | undefined>;
    STATUSES.forEach((s, i) => {
      const d = bucketQueries[i].data;
      m[s] = d?.total ?? d?.items.length;
    });
    return m;
  }, [bucketQueries]);

  const newCount = buckets.new;
  const allCount = (buckets.new ?? 0) + (buckets.contacted ?? 0) + (buckets.closed ?? 0);

  const respond = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      adminApiWithStepUp(`/admin/demo-requests/${id}/respond`, { method: "POST", json: { status: newStatus } }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin", "demo-requests"] });
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Megaphone size={13} aria-hidden />}
          kicker="Catalog"
          kickerMeta={newCount != null ? `${newCount} new leads` : "Demo requests"}
          title={
            <>
              Demo{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                requests
              </span>
            </>
          }
          description={
            (newCount ?? 0) > 0
              ? `${newCount} fresh lead${newCount === 1 ? "" : "s"} from the website — reach out, then close the loop.`
              : "Sales leads submitted through the marketing site. Contact them, then close the request."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                Step-up auth on replies
              </span>
              {(newCount ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <Megaphone size={12} aria-hidden />
                  {newCount} awaiting contact
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
            label="New"
            icon={<Megaphone size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={buckets.new != null ? String(buckets.new) : "…"}
            sub={buckets.new ? "Awaiting first contact" : "Inbox is clear"}
            pulse={(buckets.new ?? 0) > 0}
            badge={buckets.new ? { text: "Action", tone: "bg-violet-50 text-violet-700" } : undefined}
            active={status === "new"}
            onClick={() => setStatus("new")}
          />
          <StatTile
            label="Contacted"
            icon={<Phone size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={buckets.contacted != null ? String(buckets.contacted) : "…"}
            sub="Conversation started"
            active={status === "contacted"}
            onClick={() => setStatus("contacted")}
          />
          <StatTile
            label="Closed"
            icon={<CheckCircle2 size={16} />}
            tone="bg-slate-100 text-slate-600"
            value={buckets.closed != null ? String(buckets.closed) : "…"}
            sub="Loop closed"
            active={status === "closed"}
            onClick={() => setStatus("closed")}
          />
          <StatTile
            label="All leads"
            icon={<FileText size={16} />}
            tone="bg-teal-50 text-teal-600"
            value={bucketQueries.some((b) => b.data) ? allCount.toLocaleString() : "…"}
            sub="Lifetime requests"
            active={status === undefined}
            onClick={() => setStatus(undefined)}
          />
        </HeroOverlap>
      </div>

      {/* ── Lead list ──────────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="demo-list">
        <PanelHeader
          id="demo-list"
          icon={<Megaphone size={16} />}
          tone="bg-violet-50 text-violet-600"
          title={status ? `${humanize(status)} requests` : "All requests"}
          caption={
            isLoading || !data
              ? "Loading requests…"
              : `${data.items.length} of ${data.total.toLocaleString()} shown`
          }
          action={
            <Segmented<string>
              ariaLabel="Request status"
              value={status ?? "all"}
              onChange={(v) => setStatus(v === "all" ? undefined : v)}
              options={[
                { value: "all", label: "All", count: bucketQueries.some((b) => b.data) ? allCount : undefined },
                { value: "new", label: "New", count: buckets.new ?? undefined },
                { value: "contacted", label: "Contacted", count: buckets.contacted ?? undefined },
                { value: "closed", label: "Closed", count: buckets.closed ?? undefined },
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
            icon={<Megaphone size={19} />}
            title={status ? `No ${status} requests` : "No demo requests yet"}
            body={
              status === "new"
                ? "Every lead has been contacted. New requests from the website will appear here."
                : "Nothing in this bucket right now."
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {data.items.map((r) => (
              <li key={r.id} className={LIST_ROW}>
                <RowAccent className={STATUS_RAIL[r.status] ?? "bg-slate-300"} />
                <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                  <Avatar name={r.contactName} size="md" className="h-10 w-10 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                        {r.contactName}
                      </span>
                      <Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{humanize(r.status)}</Pill>
                      {r.contactRole ? (
                        <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold", STATUS_TILE[r.status] ?? "bg-slate-100 text-slate-600")}>
                          {r.contactRole}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex min-w-0 items-center gap-1 truncate">
                        <Mail size={11} aria-hidden />
                        {r.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} aria-hidden />
                        {r.phone}
                      </span>
                      {r.clinicName ? (
                        <span className="hidden items-center gap-1 sm:inline-flex">
                          <Building2 size={11} aria-hidden />
                          {r.clinicName}
                        </span>
                      ) : null}
                      {r.specialty ? (
                        <span className="hidden items-center gap-1 sm:inline-flex">
                          <Stethoscope size={11} aria-hidden />
                          {r.specialty}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock size={11} aria-hidden />
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                      {r.message ? (
                        <span className="inline-flex min-w-0 items-center gap-1 truncate" title={r.message}>
                          <FileText size={11} aria-hidden />
                          {r.message}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                  {r.status !== "contacted" ? (
                    <button
                      type="button"
                      onClick={() => respond.mutate({ id: r.id, newStatus: "contacted" })}
                      disabled={respond.isPending}
                      className={ROW_BTN_APPROVE}
                    >
                      <CheckCircle2 size={14} aria-hidden />
                      Contacted
                    </button>
                  ) : null}
                  {r.status !== "closed" ? (
                    <button
                      type="button"
                      onClick={() => respond.mutate({ id: r.id, newStatus: "closed" })}
                      disabled={respond.isPending}
                      className={ROW_BTN_QUIET}
                    >
                      <XCircle size={14} aria-hidden />
                      Close
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
