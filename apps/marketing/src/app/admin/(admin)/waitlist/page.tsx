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
      <PageHeader title="Marketing waitlist" subtitle={`${data?.total ?? 0} signups`} icon={<MailCheck size={20} className="text-blue-600" />} />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} className="admin-filter-pill" data-active={status === f.key} onClick={() => setStatus(f.key)}>
            {f.label}
          </button>
        ))}
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
            <MailCheck size={18} aria-hidden />
          </div>Empty.</div>
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