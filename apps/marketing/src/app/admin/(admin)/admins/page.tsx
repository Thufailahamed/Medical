"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog, Loader2, Search, ShieldOff, ShieldCheck, UserMinus } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { getPasskey } from "@/portal/lib/webauthn";
import { setStepUpToken } from "@/portal/lib/admin-api";

interface AdminRow {
  id: string;
  name: string | null;
  email: string | null;
  status: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  auditCountLast30d: number;
}

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

export default function AdminAdminsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: adminQk.admins(),
    queryFn: () => adminApi<{ items: AdminRow[]; total: number }>("/admin/admins"),
  });

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [actionFor, setActionFor] = useState<AdminRow | null>(null);
  const [actionKind, setActionKind] = useState<"demote" | "suspend" | "unsuspend" | null>(null);
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: async (input: { kind: "demote" | "suspend" | "unsuspend"; body: Record<string, unknown> }) =>
      adminApiWithStepUp<{ ok: boolean }>(`/admin/admins/${input.kind}`, {
        method: "POST",
        json: input.body,
      }, refreshStepUp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQk.admins() });
      setActionFor(null);
      setActionKind(null);
      setReason("");
    },
  });

  const promote = useMutation({
    mutationFn: async (body: { userId: string; reason: string }) =>
      adminApiWithStepUp<{ ok: boolean }>("/admin/admins/promote", {
        method: "POST",
        json: body,
      }, refreshStepUp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQk.admins() });
      setPromoteOpen(false);
    },
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <PageHeader
        title="Administrators"
        subtitle="Promote, demote, and suspend super_admin accounts. All destructive actions are audited."
        icon={<UserCog size={20} className="text-blue-600" />}
        actions={
          <Button onClick={() => setPromoteOpen(true)}>
            <UserCog size={12} className="mr-1" /> Promote existing user
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-surface p-5 shadow-sm" role="status" aria-label="Loading">
          <div className="h-4 w-1/4 admin-shimmer rounded-md" />
          <div className="h-4 w-full admin-shimmer rounded-md" />
          <div className="h-4 w-5/6 admin-shimmer rounded-md" />
          <div className="h-4 w-2/3 admin-shimmer rounded-md" />
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Status</TH>
              <TH>Last login</TH>
              <TH className="text-right">Audit (30d)</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {data?.items.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">{a.name ?? "—"}</TD>
                <TD className="text-text-soft">{a.email ?? "—"}</TD>
                <TD>
                  <Pill
                    tone={a.status === "active" ? "success" : a.status === "suspended" ? "danger" : "neutral"}
                  >
                    {a.status ?? "unknown"}
                  </Pill>
                </TD>
                <TD className="text-xs text-text-soft">
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : "—"}
                </TD>
                <TD className="text-right text-xs font-mono">{a.auditCountLast30d}</TD>
                <TD className="text-right">
                  <div className="inline-flex gap-1">
                      {a.status === "suspended" ? (
                        <Button size="sm" variant="ghost" onClick={() => { setActionFor(a); setActionKind("unsuspend"); }}>
                          <ShieldCheck size={12} className="mr-1" /> Unsuspend
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => { setActionFor(a); setActionKind("suspend"); }}>
                          <ShieldOff size={12} className="mr-1" /> Suspend
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setActionFor(a); setActionKind("demote"); }}>
                        <UserMinus size={12} className="mr-1" /> Demote
                      </Button>
                    </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={!!actionFor && !!actionKind}
        onClose={() => { setActionFor(null); setActionKind(null); }}
        title={actionKind ? `${actionKind[0].toUpperCase()}${actionKind.slice(1)} ${actionFor?.name ?? "admin"}` : ""}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setActionFor(null); setActionKind(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!actionFor || !actionKind) return;
                mut.mutate({
                  kind: actionKind,
                  body: { userId: actionFor.id, reason: reason.trim() || "(no reason provided)" },
                });
              }}
              disabled={mut.isPending}
              className="bg-blue-600 text-white"
            >
              {mut.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              Confirm
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-text-soft">
            This action will be audited. {actionKind === "demote"
              ? "The user will be moved to the patient role."
              : actionKind === "suspend"
                ? "The user will be unable to sign in until reactivated."
                : "The user will regain sign-in access."}
          </p>
          <div>
            <label className="block text-xs font-semibold mb-1">Reason (min 3 chars)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-20 px-3 py-2 rounded-lg border border-border bg-surface text-sm resize-none"
              placeholder="e.g. Audit policy update"
            />
          </div>
        </div>
      </Modal>

      <PromoteModal
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        onSubmit={(userId, reason) => promote.mutate({ userId, reason })}
        isPending={promote.isPending}
      />
    </div>
  );
}

function PromoteModal({ open, onClose, onSubmit, isPending }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (userId: string, reason: string) => void;
  isPending: boolean;
}) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "promote-search", email],
    queryFn: () => adminApi<{ items: Array<{ id: string; name: string; email: string; role: string }> }>(
      `/admin/users?q=${encodeURIComponent(email)}&limit=10`,
    ),
    enabled: email.length >= 3,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Promote user to super_admin"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1">Search by email</label>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-soft" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-surface text-sm"
              placeholder="user@example.com"
            />
          </div>
        </div>
        {isLoading ? (
          <p className="text-xs text-text-soft">Searching…</p>
        ) : data?.items && data.items.length > 0 ? (
          <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
            {data.items.filter((u) => u.role !== "super_admin").map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setEmail(u.email ?? "");
                  setReason(`Promote ${u.email}`);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-bg border-b border-border last:border-b-0"
              >
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-text-soft">{u.email} · {u.role}</div>
              </button>
            ))}
          </div>
        ) : email.length >= 3 ? (
          <p className="text-xs text-text-soft">No matching non-admin users found.</p>
        ) : null}
        <div>
          <label className="block text-xs font-semibold mb-1">Reason (min 3 chars)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full h-20 px-3 py-2 rounded-lg border border-border bg-surface text-sm resize-none"
          />
        </div>
        <Button
          onClick={async () => {
            const target = data?.items?.find((u) => u.email === email);
            if (!target) return;
            onSubmit(target.id, reason);
          }}
          disabled={!data?.items || reason.trim().length < 3 || isPending}
          className="w-full bg-emerald-600 text-white"
        >
          {isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
          Promote
        </Button>
      </div>
    </Modal>
  );
}