"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  FileText,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
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
import { humanize, ROW_BTN_APPROVE, ROW_BTN_DANGER } from "@/portal/components/admin/AdminDirectory";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  id: string;
  patientId: string;
  insuranceId: string;
  hospitalId: string;
  appointmentId: string | null;
  amount: number;
  status: string;
  documents: string | null;
  notes: string | null;
};

const STATUSES = ["submitted", "under_review", "approved", "rejected", "paid"] as const;
type StatusKey = (typeof STATUSES)[number];

const STATUS_TONE: Record<string, "warn" | "info" | "success" | "danger"> = {
  submitted: "warn",
  under_review: "info",
  approved: "success",
  rejected: "danger",
  paid: "success",
};

const STATUS_TILE: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-600",
  under_review: "bg-sky-50 text-sky-600",
  approved: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600",
  paid: "bg-emerald-50 text-emerald-600",
};

const STATUS_RAIL: Record<string, string> = {
  submitted: "bg-amber-400",
  under_review: "bg-sky-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
  paid: "bg-emerald-500",
};

export default function AdminInsuranceClaimsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("submitted");
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: adminQk.insuranceClaims(status),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/insurance-claims?status=${status}&limit=200`),
  });

  // Per-bucket counts for the stat strip + segmented control. The bucket for
  // the active status shares its query key with the list above, so it is free.
  const bucketQueries = useQueries({
    queries: STATUSES.map((s) => ({
      queryKey: adminQk.insuranceClaims(s),
      queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/insurance-claims?status=${s}&limit=200`),
      staleTime: 30_000,
    })),
  });
  const buckets = useMemo(() => {
    const m = {} as Record<StatusKey, { count?: number; sum: number }>;
    STATUSES.forEach((s, i) => {
      const d = bucketQueries[i].data;
      m[s] = {
        count: d?.total ?? d?.items.length,
        sum: (d?.items ?? []).reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      };
    });
    return m;
  }, [bucketQueries]);

  const openCount = (buckets.submitted.count ?? 0) + (buckets.under_review.count ?? 0);
  const openSum = buckets.submitted.sum + buckets.under_review.sum;

  const decide = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason?: string }) =>
      adminApiWithStepUp(`/admin/insurance-claims/${id}/${action}`, { method: "POST", json: reason ? { reason } : {} }),
    onSuccess: (_, vars) => {
      toast.success(`Claim ${vars.action}d`);
      qc.invalidateQueries({ queryKey: ["admin", "insurance-claims"] });
      setRejectTarget(null);
      setReason("");
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Receipt size={13} aria-hidden />}
          kicker="Operations"
          kickerMeta={data ? `${openCount} open claims` : "Insurance claims"}
          title={
            <>
              Insurance{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                claims
              </span>
            </>
          }
          description={
            openCount > 0
              ? `${openCount} claim${openCount === 1 ? "" : "s"} totalling LKR ${openSum.toLocaleString()} awaiting adjudication.`
              : "Adjudicate hospital claims submitted to insurers — approve for payout or reject with a reason."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                Step-up auth on every decision
              </span>
              {openCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <Receipt size={12} aria-hidden />
                  {openCount} awaiting review
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
            label="Submitted"
            icon={<Receipt size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={buckets.submitted.count != null ? String(buckets.submitted.count) : "…"}
            sub={buckets.submitted.count ? `LKR ${buckets.submitted.sum.toLocaleString()} claimed` : "Inbox is clear"}
            pulse={(buckets.submitted.count ?? 0) > 0}
            badge={buckets.submitted.count ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={status === "submitted"}
            onClick={() => setStatus("submitted")}
          />
          <StatTile
            label="Under review"
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={buckets.under_review.count != null ? String(buckets.under_review.count) : "…"}
            sub="Being adjudicated"
            active={status === "under_review"}
            onClick={() => setStatus("under_review")}
          />
          <StatTile
            label="Approved"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={buckets.approved.count != null ? String(buckets.approved.count) : "…"}
            sub={`LKR ${buckets.approved.sum.toLocaleString()} approved`}
            active={status === "approved"}
            onClick={() => setStatus("approved")}
          />
          <StatTile
            label="Rejected"
            icon={<XCircle size={16} />}
            tone="bg-red-50 text-red-600"
            value={buckets.rejected.count != null ? String(buckets.rejected.count) : "…"}
            sub="Declined claims"
            active={status === "rejected"}
            onClick={() => setStatus("rejected")}
          />
        </HeroOverlap>
      </div>

      {/* ── Claims ledger ──────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="clm-list">
        <PanelHeader
          id="clm-list"
          icon={<Receipt size={16} />}
          tone="bg-sky-50 text-sky-600"
          title={`${humanize(status)} claims`}
          caption={
            isLoading || !data
              ? "Loading claims…"
              : `${data.items.length} of ${data.total.toLocaleString()} shown`
          }
          action={
            <Segmented<string>
              ariaLabel="Claim status"
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
            icon={<Receipt size={19} />}
            title={`No ${humanize(status).toLowerCase()} claims`}
            body={
              status === "submitted"
                ? "Every submitted claim has been adjudicated. New claims from hospitals will appear here."
                : "Nothing in this bucket right now."
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {data.items.map((c) => {
              const actionable = c.status === "submitted" || c.status === "under_review";
              return (
                <li key={c.id} className={LIST_ROW}>
                  <RowAccent className={STATUS_RAIL[c.status] ?? "bg-slate-300"} />
                  <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                        STATUS_TILE[c.status] ?? "bg-slate-100 text-slate-600",
                      )}
                    >
                      <Receipt size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900 tabular-nums">
                          LKR {Number(c.amount).toLocaleString()}
                        </span>
                        <Pill tone={STATUS_TONE[c.status] ?? "neutral"}>{humanize(c.status)}</Pill>
                        {c.documents ? (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
                            Docs attached
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px]">
                          <User size={11} aria-hidden />
                          Patient {c.patientId.slice(0, 8)}…
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px]">
                          <Building2 size={11} aria-hidden />
                          {c.hospitalId.slice(0, 8)}…
                        </span>
                        {c.appointmentId ? (
                          <span className="hidden items-center gap-1 font-mono text-[11px] sm:inline-flex">
                            <Stethoscope size={11} aria-hidden />
                            Appt {c.appointmentId.slice(0, 8)}…
                          </span>
                        ) : null}
                        {c.notes ? (
                          <span className="inline-flex min-w-0 items-center gap-1 truncate" title={c.notes}>
                            <FileText size={11} aria-hidden />
                            {c.notes}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </div>
                  {actionable ? (
                    <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                      <button
                        type="button"
                        onClick={() => decide.mutate({ id: c.id, action: "approve" })}
                        disabled={decide.isPending}
                        className={ROW_BTN_APPROVE}
                      >
                        <CheckCircle2 size={14} aria-hidden />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectTarget(c)}
                        className={ROW_BTN_DANGER}
                      >
                        <XCircle size={14} aria-hidden />
                        Reject
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject claim">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rejectTarget || reason.trim().length < 1) {
              toast.error("Reason required");
              return;
            }
            decide.mutate({ id: rejectTarget.id, action: "reject", reason: reason.trim() });
          }}
        >
          <Field label="Reason" htmlFor="reject-claim-reason" required>
            <Input id="reject-claim-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={decide.isPending}>Reject claim</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
