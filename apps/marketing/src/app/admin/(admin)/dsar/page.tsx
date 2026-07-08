"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileLock2, CheckCircle2, ExternalLink, XCircle, RotateCw, Loader2 } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
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
const STATUS_TONE: Record<string, "warn" | "info" | "success" | "neutral" | "danger"> = {
  queued: "warn",
  approved: "info",
  processing: "info",
  completed: "success",
  cancelled: "neutral",
  failed: "danger",
};

export default function AdminDSARPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("queued");
  const [completeTarget, setCompleteTarget] = useState<Row | null>(null);
  const [resultUrl, setResultUrl] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: adminQk.dsar(status),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/dsar?status=${status}&limit=200`),
  });

  const approve = useMutation({
    mutationFn: (id: string) => adminApi(`/admin/dsar/${id}/approve`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["admin", "dsar"] });
    },
    onError: (e: any) => toast.error("Failed", e.message),
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
    onError: (e: any) => toast.error("Failed", e.message),
  });

  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function refreshStepUp(): Promise<string> {
    const opts = await adminApi<any>("/admin/webauthn/auth/options", { method: "POST", json: {} });
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
    onError: (e: any) => toast.error("Failed", e.message),
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
    onError: (e: any) => toast.error("Failed", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader title="Privacy / DSAR requests" icon={<FileLock2 size={20} className="text-amber-600" />} />

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button key={s} className="admin-filter-pill" data-active={status === s} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">No {status} requests.</div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Requester</TH>
              <TH>Purpose</TH>
              <TH>Requested</TH>
              <TH>Status</TH>
              <TH>Result</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs font-mono">{r.userId.slice(0, 8)}…</TD>
                <TD><Pill>{r.purpose}</Pill></TD>
                <TD className="text-xs text-text-muted">{new Date(r.requestedAt).toLocaleString()}</TD>
                <TD><Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Pill></TD>
                <TD className="text-xs">
                  {r.resultUrl ? (
                    <a href={r.resultUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-700 hover:underline">
                      Download <ExternalLink size={12} />
                    </a>
                  ) : "—"}
                </TD>
                <TD className="text-right">
                  <div className="inline-flex gap-1">
                    {r.status === "queued" ? (
                      <>
                        <Button size="sm" variant="primary" onClick={() => approve.mutate(r.id)} className="bg-emerald-600 hover:bg-emerald-700" disabled={approve.isPending}>
                          <CheckCircle2 size={14} className="mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRejectTarget(r); setRejectReason(""); }}>
                          <XCircle size={14} className="mr-1" />Reject
                        </Button>
                      </>
                    ) : r.status === "approved" ? (
                      <>
                        <Button size="sm" variant="primary" onClick={() => setCompleteTarget(r)} className="bg-emerald-600 hover:bg-emerald-700">
                          Mark complete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRejectTarget(r); setRejectReason(""); }}>
                          <XCircle size={14} className="mr-1" />Reject
                        </Button>
                      </>
                    ) : r.status === "processing" ? (
                      <Button size="sm" variant="ghost" onClick={() => { setRejectTarget(r); setRejectReason(""); }}>
                        <XCircle size={14} className="mr-1" />Reject
                      </Button>
                    ) : r.status === "failed" ? (
                      <Button size="sm" variant="primary" onClick={() => requeue.mutate(r.id)} disabled={requeue.isPending} className="bg-blue-600 hover:bg-blue-700">
                        <RotateCw size={14} className="mr-1" />Re-queue
                      </Button>
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

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