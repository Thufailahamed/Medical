"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
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
const STATUS_TONE: Record<string, "warn" | "info" | "success" | "danger"> = {
  submitted: "warn",
  under_review: "info",
  approved: "success",
  rejected: "danger",
  paid: "success",
};

export default function AdminInsuranceClaimsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("submitted");
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: adminQk.insuranceClaims(status),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/insurance-claims?status=${status}&limit=200`),
  });

  const decide = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason?: string }) =>
      adminApi(`/admin/insurance-claims/${id}/${action}`, { method: "POST", json: reason ? { reason } : {} }),
    onSuccess: (_, vars) => {
      toast.success(`Claim ${vars.action}d`);
      qc.invalidateQueries({ queryKey: ["admin", "insurance-claims"] });
      setRejectTarget(null);
      setReason("");
    },
    onError: (e: any) => toast.error("Failed", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader title="Insurance claims" icon={<Receipt size={20} className="text-amber-600" />} />

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button key={s} className="admin-filter-pill" data-active={status === s} onClick={() => setStatus(s)}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">No {status} claims.</div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Patient</TH>
              <TH>Hospital</TH>
              <TH>Amount</TH>
              <TH>Notes</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((c) => (
              <TR key={c.id}>
                <TD className="text-xs font-mono">{c.patientId.slice(0, 8)}…</TD>
                <TD className="text-xs font-mono">{c.hospitalId.slice(0, 8)}…</TD>
                <TD className="text-sm font-semibold">LKR {Number(c.amount).toLocaleString()}</TD>
                <TD className="text-xs max-w-xs truncate">{c.notes || "—"}</TD>
                <TD><Pill tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Pill></TD>
                <TD className="text-right">
                  {c.status === "submitted" || c.status === "under_review" ? (
                    <div className="flex gap-1.5 justify-end">
                      <Button size="sm" variant="primary" onClick={() => decide.mutate({ id: c.id, action: "approve" })} className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 size={14} className="mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRejectTarget(c)}>
                        <XCircle size={14} className="mr-1" />Reject
                      </Button>
                    </div>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

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