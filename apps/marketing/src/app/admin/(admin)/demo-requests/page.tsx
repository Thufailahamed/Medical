"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  id: string;
  contactName: string;
  contactRole: string | null;
  email: string;
  phone: string;
  clinicName: string | null;
  specialty: string | null;
  status: string;
  message: string | null;
  createdAt: string;
};

const FILTERS = [
  { key: undefined, label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "closed", label: "Closed" },
] as const;

const STATUS_TONE: Record<string, "brand" | "success" | "neutral"> = {
  new: "brand",
  contacted: "success",
  closed: "neutral",
};

export default function AdminDemoRequestsPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const [status, setStatus] = useState<string | undefined>(params.get("status") ?? undefined);

  useEffect(() => {
    setStatus(params.get("status") ?? undefined);
  }, [params]);

  const { data, isLoading } = useQuery({
    queryKey: adminQk.demoRequests(status),
    queryFn: () =>
      adminApi<{ items: Row[]; total: number }>(
        status
          ? `/admin/demo-requests?status=${status}&limit=200`
          : `/admin/demo-requests?limit=200`,
      ),
  });

  const respond = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      adminApiWithStepUp(`/admin/demo-requests/${id}/respond`, { method: "POST", json: { status: newStatus } }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin", "demo-requests"] });
    },
    onError: (e: any) => toast.error("Failed", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader title="Demo requests" subtitle={`${data?.total ?? 0} total`} icon={<Megaphone size={20} className="text-blue-600" />} />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            className="admin-filter-pill"
            data-active={status === f.key}
            onClick={() => setStatus(f.key as string | undefined)}
          >
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
            <Megaphone size={18} aria-hidden />
          </div>No demo requests.</div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Contact</TH>
              <TH>Clinic</TH>
              <TH>Specialty</TH>
              <TH>Status</TH>
              <TH>Received</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((r) => (
              <TR key={r.id}>
                <TD>
                  <p className="font-semibold text-sm">{r.contactName}</p>
                  <p className="text-[11px] text-text-muted">{r.email} · {r.phone}</p>
                </TD>
                <TD className="text-sm">{r.clinicName || "—"}</TD>
                <TD className="text-xs">{r.specialty || "—"}</TD>
                <TD><Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Pill></TD>
                <TD className="text-xs text-text-muted">{new Date(r.createdAt).toLocaleString()}</TD>
                <TD className="text-right">
                  <div className="flex gap-1.5 justify-end">
                    {r.status !== "contacted" ? (
                      <Button size="sm" variant="primary" onClick={() => respond.mutate({ id: r.id, newStatus: "contacted" })} className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 size={14} className="mr-1" />Contacted
                      </Button>
                    ) : null}
                    {r.status !== "closed" ? (
                      <Button size="sm" variant="secondary" onClick={() => respond.mutate({ id: r.id, newStatus: "closed" })}>
                        Close
                      </Button>
                    ) : null}
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