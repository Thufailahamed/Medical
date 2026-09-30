"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Hash, Hospital, MapPin, Phone, Tag, User, UserCheck } from "lucide-react";

import { Pill } from "@/portal/components/ui/Pill";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { DoctorHero, HERO_CHIP, HERO_GHOST, StatTile } from "@/portal/components/doctor/Workspace";
import {
  AdminDirectory,
  OrgTile,
  humanize,
  statusRail,
  statusTone,
  type DirectoryRow,
} from "@/portal/components/admin/AdminDirectory";

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

type Filter = "all" | "active" | "pending" | "unlicensed";

export default function AdminClinicsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading } = useQuery({
    queryKey: adminQk.tenants("clinic"),
    queryFn: () => adminApi<{ items: Row[] }>(`/admin/tenants?type=clinic&limit=200`),
  });

  const items = data?.items ?? [];
  const active = items.filter((c) => c.ownerStatus === "active").length;
  const pending = items.filter((c) => statusTone(c.ownerStatus) === "warn").length;
  const unlicensed = items.filter((c) => !c.license).length;
  const licensed = items.length - unlicensed;

  const filtered = items.filter((c) =>
    filter === "active"
      ? c.ownerStatus === "active"
      : filter === "pending"
        ? statusTone(c.ownerStatus) === "warn"
        : filter === "unlicensed"
          ? !c.license
          : true,
  );

  const rows: DirectoryRow[] = filtered.map((c) => ({
    id: c.id,
    name: c.name,
    href: `/admin/tenants/clinic/${c.id}`,
    leading: <OrgTile icon={<Hospital size={17} />} tone="from-violet-500 to-purple-600 shadow-violet-500/30" />,
    accent: statusRail(c.ownerStatus),
    badges: (
      <>
        <Pill tone={statusTone(c.ownerStatus)}>{humanize(c.ownerStatus)}</Pill>
        {c.shortCode ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-600">
            <Tag size={10} />
            {c.shortCode}
          </span>
        ) : null}
      </>
    ),
    meta: [
      { icon: <User size={11} />, text: c.ownerName },
      ...(c.license ? [{ icon: <Hash size={11} />, text: c.license, mono: true }] : []),
      ...(c.address ? [{ icon: <MapPin size={11} />, text: c.address, wide: true }] : []),
      ...(c.phone ? [{ icon: <Phone size={11} />, text: c.phone, wide: true }] : []),
    ],
    searchText: [c.shortCode, c.license, c.address, c.phone, c.ownerName, c.ownerEmail].filter(Boolean).join(" "),
  }));

  return (
    <AdminDirectory<Filter>
      hero={
        <DoctorHero
          kickerIcon={<Hospital size={13} aria-hidden />}
          kicker="Tenant network"
          kickerMeta={`${items.length} clinic${items.length === 1 ? "" : "s"}`}
          title={
            <>
              Clinics{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                &amp; practices
              </span>
            </>
          }
          description="Independent and multi-doctor clinics, their short codes, licences and owners."
          chips={
            <span className={HERO_CHIP}>
              <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
              {active} active · {licensed} licensed
            </span>
          }
          actions={
            <Link href="/admin/approvals" className={HERO_GHOST}>
              <UserCheck size={15} aria-hidden />
              Approvals
            </Link>
          }
        />
      }
      stats={
        <>
          <StatTile label="Clinics" icon={<Hospital size={16} />} tone="bg-violet-50 text-violet-600" value={isLoading ? "…" : String(items.length)} sub="Tenants on the platform" active={filter === "all"} onClick={() => setFilter("all")} />
          <StatTile label="Active owners" icon={<CheckCircle2 size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(active)} sub="Admin accounts live" progress={items.length ? Math.round((active / items.length) * 100) : null} active={filter === "active"} onClick={() => setFilter("active")} />
          <StatTile label="Pending owners" icon={<Clock size={16} />} tone="bg-amber-50 text-amber-600" value={String(pending)} sub={pending ? "Awaiting approval" : "Nothing pending"} pulse={pending > 0} active={filter === "pending"} onClick={() => setFilter("pending")} />
          <StatTile label="Licensed" icon={<Hash size={16} />} tone="bg-sky-50 text-sky-600" value={String(licensed)} unit={items.length ? `/ ${items.length}` : undefined} sub={unlicensed ? `${unlicensed} missing a licence` : "All licensed"} progress={items.length ? Math.round((licensed / items.length) * 100) : null} active={filter === "unlicensed"} onClick={() => setFilter("unlicensed")} />
        </>
      }
      title="Clinic directory"
      icon={<Hospital size={16} />}
      tone="bg-violet-50 text-violet-600"
      rows={rows}
      total={items.length}
      loading={isLoading}
      searchPlaceholder="Search name, code, licence or owner…"
      segmented={{
        value: filter,
        onChange: setFilter,
        options: [
          { value: "all", label: "All", count: items.length },
          { value: "active", label: "Active", count: active },
          { value: "pending", label: "Pending", count: pending },
          { value: "unlicensed", label: "No licence", count: unlicensed },
        ],
      }}
      empty={{ icon: <Hospital size={19} />, title: "No clinics yet", body: "Clinics appear here once an owner registers one." }}
    />
  );
}
