"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { Building2 } from "lucide-react";

type Row = {
  id: string;
  name: string;
  license: string | null;
  address: string | null;
  phone: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerStatus: string;
  rating: number | null;
  createdAt: string;
};

export default function AdminHospitalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: adminQk.tenants("hospital"),
    queryFn: () => adminApi<{ items: Row[] }>(`/admin/tenants?type=hospital&limit=200`),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        icon={<Building2 size={20} className="text-blue-600" />}
        title="Hospitals" subtitle={`${data?.items.length ?? 0} tenants`} 
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
            <Building2 size={18} aria-hidden />
          </div>
          No hospitals.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>License</TH>
              <TH>Address</TH>
              <TH>Phone</TH>
              <TH>Owner</TH>
              <TH>Rating</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((h) => (
              <TR key={h.id} className="hover:bg-surface-2 cursor-pointer">
                <TD className="font-semibold">
                  <Link href={`/admin/tenants/hospital/${h.id}`} className="hover:underline">
                    {h.name}
                  </Link>
                </TD>
                <TD className="text-xs">{h.license || "—"}</TD>
                <TD className="text-xs">{h.address || "—"}</TD>
                <TD className="text-xs">{h.phone || "—"}</TD>
                <TD>
                  <p className="text-sm">{h.ownerName}</p>
                  <Pill tone={h.ownerStatus === "active" ? "success" : "warn"}>{h.ownerStatus}</Pill>
                </TD>
                <TD className="text-xs">{h.rating ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
