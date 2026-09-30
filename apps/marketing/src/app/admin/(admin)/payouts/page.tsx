"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarRange,
  CheckCircle2,
  Hash,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Wallet,
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
import { humanize, ROW_BTN_APPROVE, ROW_BTN_DANGER } from "@/portal/components/admin/AdminDirectory";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  id: string;
  doctorId: string;
  periodStart: string;
  periodEnd: string;
  amountLkr: number;
  eventCount: number;
  status: string;
  reference: string | null;
  paidAt: string | null;
};

const STATUSES = ["pending", "paid", "failed"] as const;
type StatusKey = (typeof STATUSES)[number];

const STATUS_TONE: Record<string, "warn" | "success" | "danger"> = {
  pending: "warn",
  paid: "success",
  failed: "danger",
};

const STATUS_TILE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600",
  paid: "bg-emerald-50 text-emerald-600",
  failed: "bg-red-50 text-red-600",
};

const STATUS_RAIL: Record<string, string> = {
  pending: "bg-amber-400",
  paid: "bg-emerald-500",
  failed: "bg-red-500",
};

export default function AdminPayoutsPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const paramStatus = params.get("status") ?? "pending";
  const [status, setStatus] = useState<string>(paramStatus);
  const [prevParamStatus, setPrevParamStatus] = useState(paramStatus);
  const [payTarget, setPayTarget] = useState<Row | null>(null);
  const [reference, setReference] = useState("");
  const [failTarget, setFailTarget] = useState<Row | null>(null);
  const [failReason, setFailReason] = useState("");

  // Keep the filter in sync when the URL param changes (e.g. deep links).
  if (paramStatus !== prevParamStatus) {
    setPrevParamStatus(paramStatus);
    setStatus(paramStatus);
  }

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: adminQk.payouts(status),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/payouts?status=${status}&limit=200`),
  });

  // Per-bucket counts for the stat strip + segmented control. The bucket for
  // the active status shares its query key with the list above, so it is free.
  const bucketQueries = useQueries({
    queries: STATUSES.map((s) => ({
      queryKey: adminQk.payouts(s),
      queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/payouts?status=${s}&limit=200`),
      staleTime: 30_000,
    })),
  });
  const buckets = useMemo(() => {
    const m = {} as Record<StatusKey, { count?: number; sum: number }>;
    STATUSES.forEach((s, i) => {
      const d = bucketQueries[i].data;
      m[s] = {
        count: d?.total ?? d?.items.length,
        sum: (d?.items ?? []).reduce((acc, p) => acc + (p.amountLkr || 0), 0),
      };
    });
    return m;
  }, [bucketQueries]);

  const pendingCount = buckets.pending.count;
  const pendingSum = buckets.pending.sum;

  const markPaid = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      adminApiWithStepUp(`/admin/payouts/${id}/mark-paid`, { method: "POST", json: { reference } }),
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
      setPayTarget(null);
      setReference("");
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  const markFailed = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApiWithStepUp(`/admin/payouts/${id}/mark-failed`, { method: "POST", json: { reason } }),
    onSuccess: () => {
      toast.success("Marked as failed");
      qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
      setFailTarget(null);
      setFailReason("");
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Wallet size={13} aria-hidden />}
          kicker="Operations"
          kickerMeta={
            pendingCount != null
              ? `${pendingCount} awaiting settlement`
              : "Doctor payouts"
          }
          title={
            <>
              Doctor{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                payouts
              </span>
            </>
          }
          description={
            pendingCount != null && pendingCount > 0
              ? `${pendingCount} payout request${pendingCount === 1 ? "" : "s"} totalling LKR ${pendingSum.toLocaleString()} waiting to be settled.`
              : "Settle doctor payout requests — confirm the bank transfer reference or flag failed settlements."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                Step-up auth on every settlement
              </span>
              {pendingCount != null && pendingCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <Wallet size={12} aria-hidden />
                  LKR {pendingSum.toLocaleString()} to settle
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

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <StatTile
            label="Pending"
            icon={<Wallet size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={pendingCount != null ? String(pendingCount) : "…"}
            sub={pendingCount ? `LKR ${pendingSum.toLocaleString()} to settle` : "Queue is clear"}
            pulse={(pendingCount ?? 0) > 0}
            badge={pendingCount ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={status === "pending"}
            onClick={() => setStatus("pending")}
          />
          <StatTile
            label="Paid"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={buckets.paid.count != null ? String(buckets.paid.count) : "…"}
            sub={`LKR ${buckets.paid.sum.toLocaleString()} disbursed`}
            active={status === "paid"}
            onClick={() => setStatus("paid")}
          />
          <StatTile
            label="Failed"
            icon={<XCircle size={16} />}
            tone="bg-red-50 text-red-600"
            value={buckets.failed.count != null ? String(buckets.failed.count) : "…"}
            sub="Rejected settlements"
            active={status === "failed"}
            onClick={() => setStatus("failed")}
          />
        </HeroOverlap>
      </div>

      {/* ── Payout ledger ──────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="pay-list">
        <PanelHeader
          id="pay-list"
          icon={<Landmark size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          title={`${humanize(status)} payouts`}
          caption={
            isLoading || !data
              ? "Loading payouts…"
              : `${data.items.length} of ${data.total.toLocaleString()} shown`
          }
          action={
            <Segmented<string>
              ariaLabel="Payout status"
              value={status}
              onChange={setStatus}
              options={STATUSES.map((s) => ({
                value: s,
                label: humanize(s),
                count: buckets[s].count ?? undefined,
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
            icon={<Wallet size={19} />}
            title={`No ${status} payouts`}
            body={
              status === "pending"
                ? "Every payout request has been settled. New requests from doctors will appear here."
                : "Nothing in this bucket right now."
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {data.items.map((p) => (
              <li key={p.id} className={LIST_ROW}>
                <RowAccent className={STATUS_RAIL[p.status] ?? "bg-slate-300"} />
                <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                      STATUS_TILE[p.status] ?? "bg-slate-100 text-slate-600",
                    )}
                  >
                    <Wallet size={17} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 tabular-nums">
                        LKR {p.amountLkr.toLocaleString()}
                      </span>
                      <Pill tone={STATUS_TONE[p.status] ?? "neutral"}>{humanize(p.status)}</Pill>
                      <span className="text-[11px] text-slate-400">{p.eventCount} events</span>
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <CalendarRange size={11} aria-hidden />
                        {p.periodStart?.slice(0, 10)} → {p.periodEnd?.slice(0, 10)}
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px]">
                        <Stethoscope size={11} aria-hidden />
                        {p.doctorId.slice(0, 8)}…
                      </span>
                      {p.reference ? (
                        <span className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px]">
                          <Hash size={11} aria-hidden />
                          {p.reference}
                        </span>
                      ) : null}
                      {p.paidAt ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 size={11} aria-hidden />
                          Paid {new Date(p.paidAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </div>
                {p.status === "pending" ? (
                  <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => setPayTarget(p)}
                      className={ROW_BTN_APPROVE}
                    >
                      <CheckCircle2 size={14} aria-hidden />
                      Mark paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setFailTarget(p)}
                      className={ROW_BTN_DANGER}
                    >
                      <XCircle size={14} aria-hidden />
                      Failed
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title="Mark payout as paid">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!payTarget) return;
            if (reference.trim().length < 1) {
              toast.error("Reference required");
              return;
            }
            markPaid.mutate({ id: payTarget.id, reference: reference.trim() });
          }}
        >
          <Field label="Bank reference / transaction ID" htmlFor="pay-ref" required>
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={markPaid.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              Mark as paid
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!failTarget} onClose={() => setFailTarget(null)} title="Mark payout as failed">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!failTarget) return;
            markFailed.mutate({ id: failTarget.id, reason: failReason.trim() });
          }}
        >
          <Field label="Reason" htmlFor="fail-reason" required>
            <Input id="fail-reason" value={failReason} onChange={(e) => setFailReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setFailTarget(null)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={markFailed.isPending}>Mark as failed</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
