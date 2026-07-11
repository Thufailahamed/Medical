"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ScrollText, Loader2 } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { ExportButton } from "@/portal/components/admin/ExportButton";

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

type Page = { items: Row[]; total: number; limit: number; offset: number };

const PAGE_SIZE = 200;

export default function AdminAuditPage() {
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = {
    userId: userId.trim() || undefined,
    action: action.trim() || undefined,
    resource: resource.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const query = useInfiniteQuery({
    queryKey: adminQk.audit(filters),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (filters.userId) qs.set("userId", filters.userId);
      if (filters.action) qs.set("action", filters.action);
      if (filters.resource) qs.set("resource", filters.resource);
      if (filters.from) qs.set("from", filters.from);
      if (filters.to) qs.set("to", filters.to);
      qs.set("limit", String(PAGE_SIZE));
      qs.set("offset", String(pageParam));
      return adminApi<Page>(`/admin/audit?${qs.toString()}`);
    },
    getNextPageParam: (last) =>
      last.items.length === PAGE_SIZE ? last.offset + PAGE_SIZE : undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        title="System audit log"
        subtitle={`${total} events`}
        icon={<ScrollText size={20} className="text-amber-600" />}
        actions={
          <ExportButton
            exportPath="audit"
            filters={{
              userId: filters.userId,
              action: filters.action,
              resource: filters.resource,
            }}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="userId" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-56 h-9" />
        <Input placeholder="action prefix (admin.)" value={action} onChange={(e) => setAction(e.target.value)} className="w-56 h-9" />
        <Input placeholder="resource (user|doctor|...)" value={resource} onChange={(e) => setResource(e.target.value)} className="w-56 h-9" />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-surface text-sm"
          title="From date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-surface text-sm"
          title="To date"
        />
      </div>

      {query.isLoading ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">No events.</div>
      ) : (
        <>
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
              {items.map((row) => (
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
          {query.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? (
                  <><Loader2 size={14} className="mr-1 animate-spin" />Loading…</>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}