"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { Hospital } from "lucide-react";

type Row = {
  id: string;
  name: string;
  license: string | null;
  address: string | null;
  phone: string | null;
  shortCode: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerStatus: string;
};

export default function AdminClinicsPage() {
  const { data, isLoading } = useQuery({
    queryKey: adminQk.tenants("clinic"),
    queryFn: () => adminApi<{ items: Row[] }>(`/admin/tenants?type=clinic&limit=200`),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        icon={<Hospital size={20} className="text-blue-600" />}
        title="Clinics" subtitle={`${data?.items.length ?? 0} tenants`} 
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
            <Hospital size={18} aria-hidden />
          </div>
          No clinics.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>License</TH>
              <TH>Address</TH>
              <TH>Owner</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((c) => (
              <TR key={c.id} className="hover:bg-surface-2 cursor-pointer">
                <TD className="font-semibold">
                  <Link href={`/admin/tenants/clinic/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </TD>
                <TD className="text-xs font-mono">{c.shortCode || "—"}</TD>
                <TD className="text-xs">{c.license || "—"}</TD>
                <TD className="text-xs">{c.address || "—"}</TD>
                <TD>
                  <p className="text-sm">{c.ownerName}</p>
                  <Pill tone={c.ownerStatus === "active" ? "success" : "warn"}>{c.ownerStatus}</Pill>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
