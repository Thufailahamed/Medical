"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { Ambulance } from "lucide-react";

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
    queryFn: () => adminApi<{ items: Row[]; total: number }>("/admin/operator/users?role=ambulance"),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        icon={<Ambulance size={20} className="text-blue-600" />}
        title="Ambulance operators" subtitle={`${data?.total ?? 0} registered`} 
      />
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
            <Ambulance size={18} aria-hidden />
          </div>
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
              <TR key={a.id} className="hover:bg-surface-2 cursor-pointer">
                <TD className="font-semibold">
                  <Link href={`/admin/users/${a.id}`} className="hover:underline">
                    {a.name}
                  </Link>
                </TD>
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