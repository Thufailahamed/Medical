"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

export default function AdminAmbulancesPage() {
  const { data, isLoading } = useQuery({
    queryKey: adminQk.users({ role: "ambulance" }),
    queryFn: () => adminApi<{ items: Row[]; total: number }>("/admin/users?role=ambulance&limit=200"),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader title="Ambulance operators" subtitle={`${data?.total ?? 0} registered`} />
      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
          No ambulance operators.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Phone</TH>
              <TH>Status</TH>
              <TH>Joined</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((a) => (
              <TR key={a.id}>
                <TD className="font-semibold">{a.name}</TD>
                <TD className="text-xs">{a.email || "—"}</TD>
                <TD className="text-xs">{a.phone || "—"}</TD>
                <TD><Pill tone={a.status === "active" ? "success" : "warn"}>{a.status}</Pill></TD>
                <TD className="text-xs text-text-muted">{new Date(a.createdAt).toLocaleDateString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}