"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileLock2, CheckCircle2, ExternalLink } from "lucide-react";
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
                  {r.status === "queued" ? (
                    <Button size="sm" variant="primary" onClick={() => approve.mutate(r.id)} className="bg-emerald-600 hover:bg-emerald-700" disabled={approve.isPending}>
                      <CheckCircle2 size={14} className="mr-1" />Approve
                    </Button>
                  ) : r.status === "approved" ? (
                    <Button size="sm" variant="primary" onClick={() => setCompleteTarget(r)} className="bg-emerald-600 hover:bg-emerald-700">
                      Mark complete
                    </Button>
                  ) : null}
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
    </div>
  );
}