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
      <PageHeader title="Hospitals" subtitle={`${data?.items.length ?? 0} tenants`} />
      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
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
