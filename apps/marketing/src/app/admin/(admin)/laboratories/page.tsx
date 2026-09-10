"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  licenseNumber?: string | null;
  city?: string | null;
  address?: string | null;
};

export default function AdminLabsPage() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: adminQk.users({ role: "laboratory" }),
    queryFn: () => adminApi<{ items: Row[]; total: number }>("/admin/users?role=laboratory&limit=200"),
  });

  const approve = useMutation({
    mutationFn: (userId: string) =>
      adminApiWithStepUp(`/admin/approvals/${userId}/approve`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: any) => toast.error("Could not approve", e.message),
  });

  const reject = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApiWithStepUp(`/admin/approvals/${userId}/reject`, { method: "POST", json: { reason } }),
    onSuccess: () => {
      toast.success("Rejected");
      setRejectTarget(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: any) => toast.error("Could not reject", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader title="Laboratories" subtitle={`${data?.total ?? 0} registered`} />
      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
          No laboratories.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>License</TH>
              <TH>Email</TH>
              <TH>Phone</TH>
              <TH>Status</TH>
              <TH>Joined</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((l) => (
              <TR key={l.id}>
                <TD className="font-semibold">{l.name}<span className="block text-xs font-normal text-text-muted">{l.city || l.address || ""}</span></TD>
                <TD className="text-xs">{l.licenseNumber || "—"}</TD>
                <TD className="text-xs">{l.email || "—"}</TD>
                <TD className="text-xs">{l.phone || "—"}</TD>
                <TD><Pill tone={l.status === "active" ? "success" : "warn"}>{l.status}</Pill></TD>
                <TD className="text-xs text-text-muted">{new Date(l.createdAt).toLocaleDateString()}</TD>
                <TD className="text-right">
                  {l.status === "pending" ? (
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => approve.mutate(l.id)}
                        disabled={approve.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRejectTarget(l)}>
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title={`Reject ${rejectTarget?.name ?? ""}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rejectTarget) return;
            if (rejectReason.trim().length < 3) {
              toast.error("Reason required", "Please provide at least a short note.");
              return;
            }
            reject.mutate({ userId: rejectTarget.id, reason: rejectReason.trim() });
          }}
        >
          <Field label="Reason" htmlFor="reject-reason" required>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. License could not be verified"
              maxLength={500}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={reject.isPending}>
              Reject application
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}