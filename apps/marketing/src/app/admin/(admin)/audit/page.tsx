"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Input } from "@/portal/components/ui/Form";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

type Row = {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
};

export default function AdminAuditPage() {
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");

  const params = { userId: userId || undefined, action: action || undefined, resource: resource || undefined };
  const { data, isLoading } = useQuery({
    queryKey: adminQk.audit(params),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (userId) qs.set("userId", userId);
      if (action) qs.set("action", action);
      if (resource) qs.set("resource", resource);
      qs.set("limit", "100");
      return adminApi<{ items: Row[]; total: number }>(`/admin/audit?${qs.toString()}`);
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader title="System audit log" subtitle={`${data?.total ?? 0} events`} icon={<ScrollText size={20} className="text-amber-600" />} />

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="userId" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-56 h-9" />
        <Input placeholder="action prefix (admin.)" value={action} onChange={(e) => setAction(e.target.value)} className="w-56 h-9" />
        <Input placeholder="resource (user|doctor|...)" value={resource} onChange={(e) => setResource(e.target.value)} className="w-56 h-9" />
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">No events.</div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Resource</TH>
              <TH>Details</TH>
              <TH>IP</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((row) => (
              <TR key={row.id}>
                <TD className="text-xs text-text-muted whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</TD>
                <TD className="text-xs font-mono">{row.userId ? row.userId.slice(0, 8) + "…" : "—"}</TD>
                <TD><Pill tone="brand">{row.action}</Pill></TD>
                <TD className="text-xs">{row.resource}{row.resourceId ? ` · ${row.resourceId.slice(0, 8)}…` : ""}</TD>
                <TD className="text-xs max-w-md truncate" title={row.details || ""}>{row.details || "—"}</TD>
                <TD className="text-xs text-text-muted">{row.ip || "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}