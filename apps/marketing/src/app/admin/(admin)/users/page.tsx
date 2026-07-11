"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Search, Trash2, Pause, Play, Eye, Loader2 } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { ExportButton } from "@/portal/components/admin/ExportButton";
import { Pill, PillRow } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { BulkActionBar } from "@/portal/components/admin/BulkActionBar";
import { adminApi, adminApiWithStepUp, adminQk, setStepUpToken, setImpersonationToken } from "@/portal/lib/admin-api";
import { getPasskey } from "@/portal/lib/webauthn";
import { toast } from "@/portal/components/ui/Toast";

const ROLES = ["all", "patient", "doctor", "hospital_admin", "hospital_staff", "laboratory", "pharmacy", "insurance", "ambulance", "super_admin"] as const;
const STATUSES = ["all", "active", "pending", "suspended", "rejected"] as const;

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  approvedAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
};

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  active: "success",
  pending: "warn",
  suspended: "danger",
  rejected: "danger",
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<Row | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const params = {
    role: role === "all" ? undefined : role,
    status: statusFilter === "all" ? undefined : statusFilter,
    q: q || undefined,
    limit: 100,
  };
  const { data, isLoading } = useQuery({
    queryKey: adminQk.users(params),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.role) qs.set("role", params.role);
      if (params.status) qs.set("status", params.status);
      if (params.q) qs.set("q", params.q);
      qs.set("limit", "100");
      return adminApi<{ items: Row[]; total: number }>(`/admin/users?${qs.toString()}`);
    },
  });

  const toggleSuspend = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "suspend" | "unsuspend"; reason?: string }) =>
      adminApiWithStepUp(`/admin/users/${id}/${action}`, {
        method: "POST",
        json: action === "suspend" ? { reason } : {},
      }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "suspend" ? "Suspended" : "Reactivated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setSuspendTarget(null);
      setSuspendReason("");
    },
    onError: (e: any) => toast.error("Failed", e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApiWithStepUp(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: any) => toast.error("Failed", e.message),
  });

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

  const [impersonateTarget, setImpersonateTarget] = useState<Row | null>(null);

  const impersonate = useMutation({
    mutationFn: (userId: string) =>
      adminApiWithStepUp<{
        token: string;
        expiresAt: string;
        targetUser: { id: string; name: string; email: string; role: string };
      }>(`/admin/impersonate/start`, {
        method: "POST",
        json: { userId },
      }, refreshStepUp),
    onSuccess: (data) => {
      setImpersonationToken({ token: data.token, expiresAt: data.expiresAt, targetUser: data.targetUser });
      toast.success(`Now acting as ${data.targetUser.name}`);
      qc.invalidateQueries({ queryKey: adminQk.impersonateWhoami() });
      setImpersonateTarget(null);
    },
    onError: (e: any) => toast.error("Failed", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        title="Users"
        subtitle={`${data?.total ?? 0} users`}
        actions={
          <ExportButton
            exportPath="users"
            filters={{
              role: role === "all" ? undefined : role,
              status: statusFilter === "all" ? undefined : statusFilter,
              q: q.trim() || undefined,
            }}
          />
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search name / email / phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 w-72 h-9"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>status: {s}</option>
          ))}
        </select>
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center">
          <p className="text-text-soft">No users match those filters.</p>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH className="w-8">
                <input
                  type="checkbox"
                  checked={data.items.length > 0 && data.items.every((u) => selected.has(u.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(data.items.map((u) => u.id)));
                    } else {
                      setSelected(new Set());
                    }
                  }}
                  className="accent-amber-600"
                />
              </TH>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Contact</TH>
              <TH>Joined</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((u) => (
              <TR key={u.id}>
                <TD>
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(u.id);
                      else next.delete(u.id);
                      setSelected(next);
                    }}
                    className="accent-amber-600"
                  />
                </TD>
                <TD>
                  <Linkish name={u.name} id={u.id} />
                </TD>
                <TD>
                  <Pill tone="brand">{u.role.replace("_", " ")}</Pill>
                </TD>
                <TD>
                  <PillRow>
                    <Pill tone={STATUS_TONE[u.status] ?? "neutral"}>{u.status}</Pill>
                    {u.suspendedReason ? (
                      <Pill tone="danger" title={u.suspendedReason}>suspended</Pill>
                    ) : null}
                  </PillRow>
                </TD>
                <TD>
                  <p className="text-xs">{u.email || "—"}</p>
                  <p className="text-[11px] text-text-muted">{u.phone || ""}</p>
                </TD>
                <TD className="text-xs text-text-muted">
                  {new Date(u.createdAt).toLocaleDateString()}
                </TD>
                <TD className="text-right">
                  <div className="flex gap-1.5 justify-end">
                    {u.role !== "super_admin" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setImpersonateTarget(u)}
                        title="Impersonate this user (step-up required)"
                      >
                        <Eye size={14} />
                      </Button>
                    ) : null}
                    {u.status === "suspended" ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => toggleSuspend.mutate({ id: u.id, action: "unsuspend" })}
                      >
                        <Play size={14} className="mr-1" />Unsuspend
                      </Button>
                    ) : u.role !== "super_admin" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSuspendTarget(u)}
                      >
                        <Pause size={14} className="mr-1" />Suspend
                      </Button>
                    ) : null}
                    {u.role !== "super_admin" ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if (confirm(`Delete ${u.name}? This cannot be undone.`)) {
                            remove.mutate(u.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <BulkActionBar
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        invalidateKeys={[adminQk.users(params)]}
      />

      <Modal open={!!suspendTarget} onClose={() => setSuspendTarget(null)} title={`Suspend ${suspendTarget?.name ?? ""}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!suspendTarget) return;
            if (suspendReason.trim().length < 3) {
              toast.error("Reason required");
              return;
            }
            toggleSuspend.mutate({ id: suspendTarget.id, action: "suspend", reason: suspendReason.trim() });
          }}
        >
          <p className="text-sm text-text-soft">
            Suspended users are blocked from signing in. You can unsuspend them at any time.
          </p>
          <Field label="Reason" htmlFor="suspend-reason" required>
            <Input
              id="suspend-reason"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. Terms of service violation"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={toggleSuspend.isPending}>
              Suspend user
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!impersonateTarget}
        onClose={() => setImpersonateTarget(null)}
        title={`Impersonate ${impersonateTarget?.name ?? ""}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImpersonateTarget(null)}>Cancel</Button>
            <Button
              onClick={() => impersonateTarget && impersonate.mutate(impersonateTarget.id)}
              disabled={impersonate.isPending}
              className="bg-red-600 text-white"
            >
              {impersonate.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              Start session
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-text-soft">
            You will receive a short-lived impersonation token. Use it to view the app exactly as <b>{impersonateTarget?.name ?? ""}</b> sees it. Every action is audited with your admin ID and the impersonated subject.
          </p>
          <p className="text-sm text-text-soft">
            A passkey assertion is required before the session can begin.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function Linkish({ name, id }: { name: string; id: string }) {
  return (
    <a href={`/admin/users/${id}`} className="hover:underline font-semibold">
      {name}
    </a>
  );
}