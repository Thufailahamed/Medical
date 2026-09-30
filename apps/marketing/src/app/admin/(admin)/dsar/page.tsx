"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileLock2,
  Loader2,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  User,
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
import { humanize, ROW_BTN_APPROVE, ROW_BTN_DANGER, ROW_BTN_QUIET } from "@/portal/components/admin/AdminDirectory";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { adminApi, adminApiWithStepUp, adminQk, setStepUpToken } from "@/portal/lib/admin-api";
import { getPasskey } from "@/portal/lib/webauthn";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  id: string;
  userId: string;
  purpose: string;
  status: string;
  requestedAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  resultUrl: string | null;
  notes: string | null;
};

const STATUSES = ["queued", "approved", "processing", "completed", "cancelled", "failed"] as const;
type StatusKey = (typeof STATUSES)[number];

const STATUS_TONE: Record<string, "warn" | "info" | "success" | "neutral" | "danger"> = {
  queued: "warn",
  approved: "info",
  processing: "info",
  completed: "success",
  cancelled: "neutral",
  failed: "danger",
};

const STATUS_TILE: Record<string, string> = {
  queued: "bg-amber-50 text-amber-600",
  approved: "bg-sky-50 text-sky-600",
  processing: "bg-violet-50 text-violet-600",
  completed: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-slate-100 text-slate-600",
  failed: "bg-red-50 text-red-600",
};

const STATUS_RAIL: Record<string, string> = {
  queued: "bg-amber-400",
  approved: "bg-sky-500",
  processing: "bg-violet-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-300",
  failed: "bg-red-500",
};

export default function AdminDSARPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("queued");
  const [completeTarget, setCompleteTarget] = useState<Row | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: adminQk.dsar(status),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/dsar?status=${status}&limit=200`),
  });

  // Per-bucket counts for the stat strip + segmented control. The bucket for
  // the active status shares its query key with the list above, so it is free.
  const bucketQueries = useQueries({
    queries: STATUSES.map((s) => ({
      queryKey: adminQk.dsar(s),
      queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/dsar?status=${s}&limit=200`),
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

  const openCount = (buckets.queued ?? 0) + (buckets.approved ?? 0) + (buckets.processing ?? 0);

  const approve = useMutation({
    mutationFn: (id: string) => adminApi(`/admin/dsar/${id}/approve`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["admin", "dsar"] });
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  const complete = useMutation({
    mutationFn: ({ id, resultUrl }: { id: string; resultUrl: string }) =>
      adminApi(`/admin/dsar/${id}/complete`, { method: "POST", json: { resultUrl } }),
    onSuccess: () => {
      toast.success("Marked complete");
      qc.invalidateQueries({ queryKey: ["admin", "dsar"] });
      setCompleteTarget(null);
      setResultUrl("");
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  async function refreshStepUp(): Promise<string> {
    const opts = await adminApi<Parameters<typeof getPasskey>[0]>("/admin/webauthn/auth/options", { method: "POST", json: {} });
    const credential = await getPasskey(opts);
    const res = await adminApi<{ stepUpToken: string }>(
      "/admin/webauthn/auth/verify",
      { method: "POST", json: credential },
    );
    setStepUpToken(res.stepUpToken);
    return res.stepUpToken;
  }

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApiWithStepUp<{ ok: boolean }>(`/admin/dsar/${id}/reject`, {
        method: "POST",
        json: { reason },
      }, refreshStepUp),
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: ["admin", "dsar"] });
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  const requeue = useMutation({
    mutationFn: (id: string) =>
      adminApiWithStepUp<{ ok: boolean }>(`/admin/dsar/${id}/requeue`, {
        method: "POST",
        json: {},
      }, refreshStepUp),
    onSuccess: () => {
      toast.success("Re-queued");
      qc.invalidateQueries({ queryKey: ["admin", "dsar"] });
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<FileLock2 size={13} aria-hidden />}
          kicker="Operations"
          kickerMeta={data ? `${openCount} open requests` : "Privacy / DSAR"}
          title={
            <>
              Privacy{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                requests
              </span>
            </>
          }
          description={
            openCount > 0
              ? `${openCount} data-subject request${openCount === 1 ? "" : "s"} in flight — approve, fulfil and attach the export link.`
              : "Data-subject access and deletion requests. Approved exports are shared with the requester via a link that expires in 14 days."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                Passkey step-up on rejection
              </span>
              {(buckets.queued ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <FileLock2 size={12} aria-hidden />
                  {buckets.queued} awaiting approval
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
            label="Queued"
            icon={<FileLock2 size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={buckets.queued != null ? String(buckets.queued) : "…"}
            sub={buckets.queued ? "Awaiting approval" : "Queue is clear"}
            pulse={(buckets.queued ?? 0) > 0}
            badge={buckets.queued ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={status === "queued"}
            onClick={() => setStatus("queued")}
          />
          <StatTile
            label="Approved"
            icon={<CheckCircle2 size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={buckets.approved != null ? String(buckets.approved) : "…"}
            sub="Ready to fulfil"
            active={status === "approved"}
            onClick={() => setStatus("approved")}
          />
          <StatTile
            label="Processing"
            icon={<Loader2 size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={buckets.processing != null ? String(buckets.processing) : "…"}
            sub="Export being built"
            active={status === "processing"}
            onClick={() => setStatus("processing")}
          />
          <StatTile
            label="Completed"
            icon={<ShieldCheck size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={buckets.completed != null ? String(buckets.completed) : "…"}
            sub="Link sent to requester"
            active={status === "completed"}
            onClick={() => setStatus("completed")}
          />
        </HeroOverlap>
      </div>

      {/* ── Request ledger ─────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="dsar-list">
        <PanelHeader
          id="dsar-list"
          icon={<FileLock2 size={16} />}
          tone="bg-rose-50 text-rose-600"
          title={`${humanize(status)} requests`}
          caption={
            isLoading || !data
              ? "Loading requests…"
              : `${data.items.length} of ${data.total.toLocaleString()} shown`
          }
          action={
            <Segmented<string>
              ariaLabel="Request status"
              value={status}
              onChange={setStatus}
              options={STATUSES.map((s) => ({
                value: s,
                label: humanize(s),
                count: buckets[s] ?? undefined,
              }))}
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
            icon={<FileLock2 size={19} />}
            title={`No ${status} requests`}
            body={
              status === "queued"
                ? "Every privacy request has been triaged. New access and deletion requests will appear here."
                : "Nothing in this bucket right now."
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {data.items.map((r) => (
              <li key={r.id} className={LIST_ROW}>
                <RowAccent className={STATUS_RAIL[r.status] ?? "bg-slate-300"} />
                <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                      STATUS_TILE[r.status] ?? "bg-slate-100 text-slate-600",
                    )}
                  >
                    <FileLock2 size={17} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold capitalize text-slate-900">
                        {humanize(r.purpose)}
                      </span>
                      <Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{humanize(r.status)}</Pill>
                      {r.resultUrl ? (
                        <a
                          href={r.resultUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-700 transition-colors hover:bg-sky-100"
                        >
                          Export <ExternalLink size={10} aria-hidden />
                        </a>
                      ) : null}
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px]">
                        <User size={11} aria-hidden />
                        {r.userId.slice(0, 8)}…
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock size={11} aria-hidden />
                        {new Date(r.requestedAt).toLocaleString()}
                      </span>
                      {r.completedAt ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 size={11} aria-hidden />
                          Completed {new Date(r.completedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                      {r.notes ? (
                        <span className="inline-flex min-w-0 items-center gap-1 truncate" title={r.notes}>
                          {r.notes}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-1.5 sm:pl-0">
                  {r.status === "queued" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => approve.mutate(r.id)}
                        disabled={approve.isPending}
                        className={ROW_BTN_APPROVE}
                      >
                        <CheckCircle2 size={14} aria-hidden />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectTarget(r); setRejectReason(""); }}
                        className={ROW_BTN_DANGER}
                      >
                        <XCircle size={14} aria-hidden />
                        Reject
                      </button>
                    </>
                  ) : r.status === "approved" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setCompleteTarget(r)}
                        className={ROW_BTN_APPROVE}
                      >
                        <CheckCircle2 size={14} aria-hidden />
                        Mark complete
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectTarget(r); setRejectReason(""); }}
                        className={ROW_BTN_DANGER}
                      >
                        <XCircle size={14} aria-hidden />
                        Reject
                      </button>
                    </>
                  ) : r.status === "processing" ? (
                    <button
                      type="button"
                      onClick={() => { setRejectTarget(r); setRejectReason(""); }}
                      className={ROW_BTN_DANGER}
                    >
                      <XCircle size={14} aria-hidden />
                      Reject
                    </button>
                  ) : r.status === "failed" ? (
                    <button
                      type="button"
                      onClick={() => requeue.mutate(r.id)}
                      disabled={requeue.isPending}
                      className={ROW_BTN_QUIET}
                    >
                      <RotateCw size={14} aria-hidden />
                      Re-queue
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={!!completeTarget} onClose={() => setCompleteTarget(null)} title="Complete DSAR request">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!completeTarget) return;
            if (!/^https?:\/\//.test(resultUrl)) {
              toast.error("Result URL must be http(s)");
              return;
            }
            complete.mutate({ id: completeTarget.id, resultUrl: resultUrl.trim() });
          }}
        >
          <p className="text-xs text-text-soft">
            Upload the export / deletion confirmation to your file store (Cloudflare R2) and paste the public URL here.
            The URL is shown to the requester and expires automatically 14 days from now.
          </p>
          <Field label="Result URL" htmlFor="dsar-url" required>
            <Input id="dsar-url" placeholder="https://files.healthhub.app/dsar/..." value={resultUrl} onChange={(e) => setResultUrl(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCompleteTarget(null)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={complete.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              Mark complete
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={`Reject request ${rejectTarget ? rejectTarget.id.slice(0, 8) : ""}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!rejectTarget) return;
                reject.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
              }}
              disabled={reject.isPending || rejectReason.trim().length < 3}
              className="bg-red-600 text-white"
            >
              {reject.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              Reject
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-text-soft">
            This will mark the request as failed. The requester is notified automatically.
          </p>
          <Field label="Reason (min 3 chars)" htmlFor="dsar-reject-reason" required>
            <textarea
              id="dsar-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full h-24 px-3 py-2 rounded-lg border border-border bg-surface text-sm resize-none"
              placeholder="e.g. Identity could not be verified"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
