"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
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

const STATUS_TONE: Record<string, "warn" | "success" | "danger"> = {
  pending: "warn",
  paid: "success",
  failed: "danger",
};

export default function AdminPayoutsPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const initialStatus = params.get("status") ?? "pending";
  const [status, setStatus] = useState<string>(initialStatus);
  const [payTarget, setPayTarget] = useState<Row | null>(null);
  const [reference, setReference] = useState("");
  const [failTarget, setFailTarget] = useState<Row | null>(null);
  const [failReason, setFailReason] = useState("");

  useEffect(() => {
    const next = params.get("status") ?? "pending";
    setStatus(next);
  }, [params]);

  const { data, isLoading } = useQuery({
    queryKey: adminQk.payouts(status),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/payouts?status=${status}&limit=200`),
  });

  const markPaid = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      adminApiWithStepUp(`/admin/payouts/${id}/mark-paid`, { method: "POST", json: { reference } }),
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
      setPayTarget(null);
      setReference("");
    },
    onError: (e: any) => toast.error("Failed", e.message),
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
    onError: (e: any) => toast.error("Failed", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader title="Doctor payouts" icon={<Wallet size={20} className="text-blue-600" />} />

      <div className="flex flex-wrap gap-1.5">
        {["pending", "paid", "failed"].map((s) => (
          <button key={s} className="admin-filter-pill" data-active={status === s} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-surface p-5 shadow-sm" role="status" aria-label="Loading">
          <div className="h-4 w-1/4 admin-shimmer rounded-md" />
          <div className="h-4 w-full admin-shimmer rounded-md" />
          <div className="h-4 w-5/6 admin-shimmer rounded-md" />
          <div className="h-4 w-2/3 admin-shimmer rounded-md" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-surface p-10 text-center text-sm font-medium text-text-soft shadow-2xs">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-muted ring-1 ring-inset ring-border">
            <Wallet size={18} aria-hidden />
          </div>No {status} payouts.</div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Period</TH>
              <TH>Doctor</TH>
              <TH>Amount</TH>
              <TH>Events</TH>
              <TH>Status</TH>
              <TH>Reference</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((p) => (
              <TR key={p.id}>
                <TD className="text-xs">{p.periodStart?.slice(0, 10)} → {p.periodEnd?.slice(0, 10)}</TD>
                <TD className="text-xs font-mono">{p.doctorId.slice(0, 8)}…</TD>
                <TD className="text-sm font-semibold">LKR {p.amountLkr.toLocaleString()}</TD>
                <TD className="text-xs">{p.eventCount}</TD>
                <TD><Pill tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Pill></TD>
                <TD className="text-xs">{p.reference || "—"}</TD>
                <TD className="text-right">
                  {p.status === "pending" ? (
                    <div className="flex gap-1.5 justify-end">
                      <Button size="sm" variant="primary" onClick={() => setPayTarget(p)} className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 size={14} className="mr-1" />Paid
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setFailTarget(p)}>
                        <XCircle size={14} className="mr-1" />Failed
                      </Button>
                    </div>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

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