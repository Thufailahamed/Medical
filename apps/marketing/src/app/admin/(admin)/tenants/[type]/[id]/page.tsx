"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { adminApi } from "@/portal/lib/admin-api";

type Tenant = {
  id: string;
  name: string;
  license: string | null;
  address: string | null;
  phone: string | null;
  rating: number | null;
  shortCode?: string | null;
  createdAt: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  ownerStatus: string;
  ownerLastLoginAt: string | null;
};

export default function AdminTenantDetailPage({
  params,
}: {
  params: { type: string; id: string };
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "tenant", params.type, params.id],
    queryFn: () =>
      adminApi<{ type: string; tenant: Tenant }>(
        `/admin/tenants/${params.type}/${params.id}`,
      ),
  });

  if (isLoading) {
    return <p className="text-text-soft text-sm">Loading…</p>;
  }
  if (error || !data) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-10 text-center">
        <p className="text-danger font-semibold mb-2">Tenant not found</p>
        <Link href={`/admin/${params.type === "clinic" ? "clinics" : "hospitals"}`} className="text-amber-600 hover:underline text-sm">
          ← Back to {params.type === "clinic" ? "clinics" : "hospitals"}
        </Link>
      </div>
    );
  }

  const t = data.tenant;
  const typeLabel = data.type === "clinic" ? "Clinic" : "Hospital";

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <Link
        href={`/admin/${data.type === "clinic" ? "clinics" : "hospitals"}`}
        className="text-sm text-text-soft hover:text-text inline-flex items-center gap-1.5 w-fit"
      >
        <ArrowLeft size={14} />Back to {data.type === "clinic" ? "clinics" : "hospitals"}
      </Link>

      <PageHeader
        title={t.name}
        subtitle={typeLabel}
        icon={<Building2 size={20} className="text-amber-600" />}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <KV label="License" value={t.license || "—"} />
        <KV label="Address" value={t.address || "—"} />
        <KV label="Phone" value={t.phone || "—"} />
        {t.shortCode !== undefined ? <KV label="Short code" value={t.shortCode || "—"} /> : null}
        <KV label="Rating" value={t.rating?.toFixed(1) ?? "—"} />
        <KV label="Created" value={new Date(t.createdAt).toLocaleString()} />
      </section>

      <section>
        <SectionHeader title="Owner" className="mb-3" />
        <div className="bg-surface border border-border rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <KV label="Name" value={t.ownerName} />
          <KV label="Email" value={t.ownerEmail} />
          <KV
            label="Status"
            value={
              <Pill tone={t.ownerStatus === "active" ? "success" : "warn"}>{t.ownerStatus}</Pill>
            }
          />
          <KV
            label="Last login"
            value={t.ownerLastLoginAt ? new Date(t.ownerLastLoginAt).toLocaleString() : "Never"}
          />
          <Link
            href={`/admin/users/${t.ownerUserId}`}
            className="text-sm text-amber-600 hover:underline mt-2"
          >
            View full user record →
          </Link>
        </div>
      </section>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-1">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}