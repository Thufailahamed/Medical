"use client";

import { useState } from "react";
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
  const [status, setStatus] = useState<string>("pending");
  const [payTarget, setPayTarget] = useState<Row | null>(null);
  const [reference, setReference] = useState("");
  const [failTarget, setFailTarget] = useState<Row | null>(null);
  const [failReason, setFailReason] = useState("");

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
      <PageHeader title="Doctor payouts" icon={<Wallet size={20} className="text-amber-600" />} />

      <div className="flex flex-wrap gap-1.5">
        {["pending", "paid", "failed"].map((s) => (
          <button key={s} className="admin-filter-pill" data-active={status === s} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">No {status} payouts.</div>
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