"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Input } from "@/portal/components/ui/Form";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

type Row = {
  id: string;
  rxcui: string | null;
  genericName: string;
  brandName: string | null;
  strength: string | null;
  scheduleClass: string | null;
  isGeneric: boolean | null;
  active: boolean | null;
};

export default function AdminMedicinesMasterPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: adminQk.medicinesMaster({ q }),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      qs.set("limit", "200");
      return adminApi<{ items: Row[]; total: number }>(`/admin/medicines-master?${qs.toString()}`);
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        title="Medicines master catalogue"
        subtitle={`${data?.total ?? 0} rows`}
        icon={<BookOpen size={20} className="text-amber-600" />}
      />

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="Search generic or brand name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8 w-72 h-9"
        />
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">No matches.</div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Generic</TH>
              <TH>Brand</TH>
              <TH>Strength</TH>
              <TH>Schedule</TH>
              <TH>Type</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((m) => (
              <TR key={m.id}>
                <TD className="font-semibold text-sm">{m.genericName}</TD>
                <TD className="text-xs">{m.brandName || "—"}</TD>
                <TD className="text-xs">{m.strength || "—"}</TD>
                <TD><Pill>{m.scheduleClass || "—"}</Pill></TD>
                <TD className="text-xs">{m.isGeneric ? "Generic" : "Brand"}</TD>
                <TD>{m.active ? <Pill tone="success">active</Pill> : <Pill tone="danger">inactive</Pill>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}