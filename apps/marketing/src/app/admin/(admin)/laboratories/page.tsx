"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";
import { Check, FlaskConical, X } from "lucide-react";
import { UserTenantDirectory, type TenantUserRow } from "@/portal/components/admin/UserTenantDirectory";
import { ROW_BTN_APPROVE, ROW_BTN_DANGER } from "@/portal/components/admin/AdminDirectory";

type Row = TenantUserRow;

export default function AdminLabsPage() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const approve = useMutation({
    mutationFn: (userId: string) =>
      adminApiWithStepUp(`/admin/approvals/${userId}/approve`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: unknown) => toast.error("Could not approve", e instanceof Error ? e.message : undefined),
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
    onError: (e: unknown) => toast.error("Could not reject", e instanceof Error ? e.message : undefined),
  });

  return (
    <UserTenantDirectory
      queryKey={adminQk.users({ role: "laboratory" })}
      endpoint="/admin/users?role=laboratory&limit=200"
      kicker="Diagnostics network"
      title="Laboratories"
      titleAccent="& pathology"
      description="Diagnostic labs that receive orders and upload results. Approve new labs once their licence is verified."
      noun="laboratory"
      icon={(s) => <FlaskConical size={s} aria-hidden />}
      tileTone="from-teal-500 to-cyan-600 shadow-teal-500/30"
      rowActions={(l) =>
        l.status === "pending" ? (
          <>
            <button
              type="button"
              onClick={() => approve.mutate(l.id)}
              disabled={approve.isPending}
              className={ROW_BTN_APPROVE}
            >
              <Check size={13} strokeWidth={2.5} />
              Approve
            </button>
            <button type="button" onClick={() => setRejectTarget(l)} className={ROW_BTN_DANGER}>
              <X size={13} />
              Reject
            </button>
          </>
        ) : null
      }
    >
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
    </UserTenantDirectory>
  );
}
