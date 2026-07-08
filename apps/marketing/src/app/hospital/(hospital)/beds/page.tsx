"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";

export default function BedsPage() {
  const locale = useAuthStore((s) => s.locale);
  const wards = useQuery({
    queryKey: ["wards"],
    queryFn: () => api<{ wards: any[] }>("/hospital-portal/wards"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.beds")}
        subtitle={tr(locale, "beds.subtitle")}
      />

      {wards.isLoading ? (
        <Card>{tr(locale, "common.loading")}</Card>
      ) : !wards.data?.wards?.length ? (
        <Empty title={tr(locale, "wards.noWards")} />
      ) : (
        <div className="space-y-6">
          {wards.data.wards.map((w: any) => (
            <WardBoard key={w.id} ward={w} />
          ))}
        </div>
      )}
    </div>
  );
}

function WardBoard({ ward }: { ward: any }) {
  const beds = useQuery({
    queryKey: ["beds", ward.id],
    queryFn: () => api<{ beds: any[] }>(`/hospital-portal/beds?wardId=${ward.id}`),
  });
  const list = beds.data?.beds ?? [];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{ward.name}</h3>
        <span className="text-sm text-[var(--text-muted)]">
          {list.filter((b: any) => b.status === "occupied").length}/{list.length} {tr(useAuthStore.getState().locale, "wards.occupied")}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">—</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {list.map((b: any) => (
            <div
              key={b.id}
              className={`flex flex-col items-center rounded-lg border p-2 text-xs ${
                b.status === "occupied"
                  ? "border-amber-300 bg-amber-50"
                  : b.status === "cleaning"
                  ? "border-sky-300 bg-sky-50"
                  : b.status === "maintenance"
                  ? "border-zinc-300 bg-zinc-50"
                  : "border-emerald-300 bg-emerald-50"
              }`}
            >
              <span className="font-mono font-semibold">{b.bedNumber}</span>
              <Pill tone="neutral" className="mt-1 text-[10px]">{b.status}</Pill>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}