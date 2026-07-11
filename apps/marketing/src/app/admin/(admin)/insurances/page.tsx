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
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

export default function AdminInsurancesPage() {
  const { data, isLoading } = useQuery({
    queryKey: adminQk.users({ role: "insurance" }),
    queryFn: () => adminApi<{ items: Row[]; total: number }>("/admin/operator/users?role=insurance"),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader title="Insurance providers" subtitle={`${data?.total ?? 0} registered`} />
      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
          No insurance providers.
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
            {data.items.map((i) => (
              <TR key={i.id} className="hover:bg-surface-2 cursor-pointer">
                <TD className="font-semibold">
                  <Link href={`/admin/users/${i.id}`} className="hover:underline">
                    {i.name}
                  </Link>
                </TD>
                <TD className="text-xs">{i.email || "—"}</TD>
                <TD className="text-xs">{i.phone || "—"}</TD>
                <TD><Pill tone={i.status === "active" ? "success" : "warn"}>{i.status}</Pill></TD>
                <TD className="text-xs text-text-muted">{new Date(i.createdAt).toLocaleDateString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
