"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pause, Play, Search, Trash2, Users } from "lucide-react";
import { cn } from "@/portal/lib/utils";
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

const ROLE_TONE: Record<string, "neutral" | "info" | "violet" | "accent" | "success" | "warn" | "danger" | "brand"> = {
  patient: "neutral",
  doctor: "info",
  hospital_admin: "violet",
  hospital_staff: "violet",
  laboratory: "accent",
  pharmacy: "success",
  insurance: "warn",
  ambulance: "danger",
  super_admin: "brand",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const ACTION_BTN =
  "grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-text-muted transition-all hover:bg-surface-2 hover:text-text hover:border-border-strong";

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
        icon={<Users size={20} className="text-blue-600" />}
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
      <div className="portal-card flex flex-wrap items-center gap-2.5 rounded-2xl border border-border/70 bg-surface p-3 shadow-2xs">
        <div className="relative w-full min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search name / email / phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-full pl-9"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-medium capitalize text-text-soft"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r === "all" ? "All roles" : r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-medium capitalize text-text-soft"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        {data ? (
          <span className="ml-auto hidden text-xs font-medium text-text-muted sm:block">
            {data.items.length} shown
          </span>
        ) : null}
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
            <Users size={18} aria-hidden />
          </div>
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
                  className="accent-blue-600"
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
              <TR key={u.id} className={cn(selected.has(u.id) && "bg-blue-50/60 hover:bg-blue-50/60")}>
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
                    className="accent-blue-600"
                  />
                </TD>
                <TD>
                  <Linkish name={u.name} id={u.id} />
                </TD>
                <TD>
                  <Pill tone={ROLE_TONE[u.role] ?? "neutral"}>{u.role.replace(/_/g, " ")}</Pill>
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
                  <div className="flex justify-end gap-1">
                    {u.role !== "super_admin" ? (
                      <button
                        type="button"
                        onClick={() => setImpersonateTarget(u)}
                        title="Impersonate this user (step-up required)"
                        aria-label={`Impersonate ${u.name}`}
                        className={ACTION_BTN}
                      >
                        <Eye size={14} />
                      </button>
                    ) : null}
                    {u.status === "suspended" ? (
                      <button
                        type="button"
                        onClick={() => toggleSuspend.mutate({ id: u.id, action: "unsuspend" })}
                        title="Unsuspend"
                        aria-label={`Unsuspend ${u.name}`}
                        className={cn(ACTION_BTN, "hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600")}
                      >
                        <Play size={14} />
                      </button>
                    ) : u.role !== "super_admin" ? (
                      <button
                        type="button"
                        onClick={() => setSuspendTarget(u)}
                        title="Suspend"
                        aria-label={`Suspend ${u.name}`}
                        className={cn(ACTION_BTN, "hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600")}
                      >
                        <Pause size={14} />
                      </button>
                    ) : null}
                    {u.role !== "super_admin" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete ${u.name}? This cannot be undone.`)) {
                            remove.mutate(u.id);
                          }
                        }}
                        title="Delete"
                        aria-label={`Delete ${u.name}`}
                        className={cn(ACTION_BTN, "hover:border-red-200 hover:bg-red-50 hover:text-red-600")}
                      >
                        <Trash2 size={14} />
                      </button>
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
    <a
      href={`/admin/users/${id}`}
      className="flex items-center gap-2.5 no-underline hover:no-underline"
    >
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-[11px] font-bold text-blue-800 ring-1 ring-inset ring-blue-300/50"
      >
        {initials(name)}
      </span>
      <span className="font-semibold text-text hover:text-blue-700 hover:underline">
        {name}
      </span>
    </a>
  );
}