"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

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
      <PageHeader title="Clinics" subtitle={`${data?.items.length ?? 0} tenants`} />
      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
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
