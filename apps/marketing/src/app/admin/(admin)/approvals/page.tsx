"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, RefreshCw, UserCheck } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill, PillRow } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

const STATUS_FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "active", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
] as const;

type Item = {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    status: string;
    createdAt: string;
    rejectionReason?: string | null;
  };
  doctorProfile?: {
    specialization?: string | null;
    slmcRegistrationNo?: string | null;
    registrationNumber?: string | null;
  } | null;
};

const ROLE_TONE: Record<string, "brand" | "success" | "warn" | "info" | "danger" | "neutral" | "accent" | "violet"> = {
  doctor: "info",
  hospital_admin: "accent",
  pharmacy: "violet",
  laboratory: "warn",
  insurance: "neutral",
  ambulance: "danger",
};

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "active" | "rejected" | "suspended">("pending");
  const [rejectTarget, setRejectTarget] = useState<Item | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: adminQk.approvals(status),
    queryFn: () => adminApi<{ items: Item[]; total: number }>(`/admin/approvals?status=${status}`),
  });

  const approve = useMutation({
    mutationFn: (userId: string) =>
      adminApi(`/admin/approvals/${userId}/approve`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: any) => toast.error("Could not approve", e.message),
  });

  const reject = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApi(`/admin/approvals/${userId}/reject`, { method: "POST", json: { reason } }),
    onSuccess: () => {
      toast.success("Rejected");
      setRejectTarget(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: any) => toast.error("Could not reject", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        title="Account approvals"
        subtitle="Review applications for gated roles. Approved accounts can sign in immediately."
        icon={<UserCheck size={20} className="text-amber-600" />}
        actions={
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            className="admin-filter-pill"
            data-active={status === f.key}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center">
          <p className="text-text-soft">No {status} applications.</p>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Contact</TH>
              <TH>Profile</TH>
              <TH>Applied</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((it) => {
              const u = it.user;
              return (
                <TR key={u.id}>
                  <TD>
                    <p className="font-semibold">{u.name}</p>
                    {u.rejectionReason ? (
                      <p className="text-[11px] text-red-600 mt-0.5">
                        Reason: {u.rejectionReason}
                      </p>
                    ) : null}
                  </TD>
                  <TD>
                    <PillRow>
                      <Pill tone={ROLE_TONE[u.role] ?? "neutral"}>{u.role.replace("_", " ")}</Pill>
                      {u.status !== "active" ? <Pill tone="warn">{u.status}</Pill> : null}
                    </PillRow>
                  </TD>
                  <TD>
                    <p className="text-sm">{u.email || u.phone || "—"}</p>
                  </TD>
                  <TD>
                    {it.doctorProfile ? (
                      <div className="text-xs text-text-soft">
                        <p>{it.doctorProfile.specialization}</p>
                        <p>SLMC: {it.doctorProfile.slmcRegistrationNo || "—"}</p>
                      </div>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </TD>
                  <TD>
                    <p className="text-xs text-text-muted">
                      {new Date(u.createdAt).toLocaleString()}
                    </p>
                  </TD>
                  <TD className="text-right">
                    {u.status === "pending" || status === "suspended" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => approve.mutate(u.id)}
                          disabled={approve.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 size={14} className="mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRejectTarget(it)}
                        >
                          <XCircle size={14} className="mr-1" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title={`Reject ${rejectTarget?.user.name ?? ""}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rejectTarget) return;
            if (rejectReason.trim().length < 3) {
              toast.error("Reason required", "Please provide at least a short note.");
              return;
            }
            reject.mutate({ userId: rejectTarget.user.id, reason: rejectReason.trim() });
          }}
        >
          <Field label="Reason" htmlFor="reject-reason" required>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. SLMC number could not be verified"
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