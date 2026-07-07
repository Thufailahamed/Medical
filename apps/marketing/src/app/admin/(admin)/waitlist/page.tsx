"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailCheck, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  id: string;
  email: string;
  role: string;
  source: string | null;
  invitedAt: string | null;
  invitedSlot: string | null;
  createdAt: string;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "invited", label: "Invited" },
] as const;

export default function AdminWaitlistPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"all" | "pending" | "invited">("all");

  const { data, isLoading } = useQuery({
    queryKey: adminQk.waitlist(status),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/waitlist?status=${status}&limit=300`),
  });

  const invite = useMutation({
    mutationFn: (id: string) => adminApi(`/admin/waitlist/${id}/invite`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Marked as invited");
      qc.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (e: any) => toast.error("Failed", e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi(`/admin/waitlist/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (e: any) => toast.error("Failed", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader title="Marketing waitlist" subtitle={`${data?.total ?? 0} signups`} icon={<MailCheck size={20} className="text-amber-600" />} />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} className="admin-filter-pill" data-active={status === f.key} onClick={() => setStatus(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">Empty.</div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Source</TH>
              <TH>Status</TH>
              <TH>Signed up</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((w) => (
              <TR key={w.id}>
                <TD className="font-semibold text-sm">{w.email}</TD>
                <TD><Pill>{w.role}</Pill></TD>
                <TD className="text-xs">{w.source || "—"}</TD>
                <TD>{w.invitedAt ? <Pill tone="success">invited</Pill> : <Pill tone="warn">pending</Pill>}</TD>
                <TD className="text-xs text-text-muted">{new Date(w.createdAt).toLocaleString()}</TD>
                <TD className="text-right">
                  <div className="flex gap-1.5 justify-end">
                    {!w.invitedAt ? (
                      <Button size="sm" variant="primary" onClick={() => invite.mutate(w.id)} disabled={invite.isPending}>
                        <Send size={14} className="mr-1" />Invite
                      </Button>
                    ) : null}
                    <Button size="sm" variant="danger" onClick={() => remove.mutate(w.id)} disabled={remove.isPending}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}