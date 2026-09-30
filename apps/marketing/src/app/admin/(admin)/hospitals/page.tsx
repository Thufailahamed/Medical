"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock, Hash, MapPin, Phone, Star, User, UserCheck } from "lucide-react";

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
  ownerName: string;
  ownerEmail: string;
  ownerStatus: string;
  rating: number | null;
  createdAt: string;
};

type Filter = "all" | "active" | "pending" | "unlicensed";

export default function AdminHospitalsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading } = useQuery({
    queryKey: adminQk.tenants("hospital"),
    queryFn: () => adminApi<{ items: Row[] }>(`/admin/tenants?type=hospital&limit=200`),
  });

  const items = data?.items ?? [];
  const active = items.filter((h) => h.ownerStatus === "active").length;
  const pending = items.filter((h) => statusTone(h.ownerStatus) === "warn").length;
  const unlicensed = items.filter((h) => !h.license).length;
  const rated = items.filter((h) => h.rating != null);
  const avgRating = rated.length ? rated.reduce((a, h) => a + (h.rating ?? 0), 0) / rated.length : null;

  const filtered = items.filter((h) =>
    filter === "active"
      ? h.ownerStatus === "active"
      : filter === "pending"
        ? statusTone(h.ownerStatus) === "warn"
        : filter === "unlicensed"
          ? !h.license
          : true,
  );

  const rows: DirectoryRow[] = filtered.map((h) => ({
    id: h.id,
    name: h.name,
    href: `/admin/tenants/hospital/${h.id}`,
    leading: <OrgTile icon={<Building2 size={17} />} tone="from-sky-500 to-blue-600 shadow-sky-500/30" />,
    accent: statusRail(h.ownerStatus),
    badges: (
      <>
        <Pill tone={statusTone(h.ownerStatus)}>{humanize(h.ownerStatus)}</Pill>
        {h.rating != null ? (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">
            <Star size={10} fill="currentColor" />
            {h.rating.toFixed(1)}
          </span>
        ) : null}
      </>
    ),
    meta: [
      { icon: <User size={11} />, text: h.ownerName },
      ...(h.license ? [{ icon: <Hash size={11} />, text: h.license, mono: true }] : []),
      ...(h.address ? [{ icon: <MapPin size={11} />, text: h.address, wide: true }] : []),
      ...(h.phone ? [{ icon: <Phone size={11} />, text: h.phone, wide: true }] : []),
    ],
    searchText: [h.license, h.address, h.phone, h.ownerName, h.ownerEmail].filter(Boolean).join(" "),
  }));

  return (
    <AdminDirectory<Filter>
      hero={
        <DoctorHero
          kickerIcon={<Building2 size={13} aria-hidden />}
          kicker="Tenant network"
          kickerMeta={`${items.length} hospital${items.length === 1 ? "" : "s"}`}
          title={
            <>
              Hospitals{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                &amp; facilities
              </span>
            </>
          }
          description="Every hospital tenant on HealthHub, its licence and the admin account that owns it."
          chips={
            <>
              <span className={HERO_CHIP}>
                <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                {active} active
              </span>
              {avgRating != null ? (
                <span className={HERO_CHIP}>
                  <Star size={12} className="text-amber-300" aria-hidden />
                  {avgRating.toFixed(1)} average rating
                </span>
              ) : null}
            </>
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
          <StatTile label="Hospitals" icon={<Building2 size={16} />} tone="bg-sky-50 text-sky-600" value={isLoading ? "…" : String(items.length)} sub="Tenants on the platform" active={filter === "all"} onClick={() => setFilter("all")} />
          <StatTile label="Active owners" icon={<CheckCircle2 size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(active)} sub="Admin accounts live" progress={items.length ? Math.round((active / items.length) * 100) : null} active={filter === "active"} onClick={() => setFilter("active")} />
          <StatTile label="Pending owners" icon={<Clock size={16} />} tone="bg-amber-50 text-amber-600" value={String(pending)} sub={pending ? "Awaiting approval" : "Nothing pending"} pulse={pending > 0} active={filter === "pending"} onClick={() => setFilter("pending")} />
          <StatTile label="Average rating" icon={<Star size={16} />} tone="bg-violet-50 text-violet-600" value={avgRating != null ? avgRating.toFixed(1) : "—"} unit={avgRating != null ? "/ 5" : undefined} sub={`${rated.length} rated · ${unlicensed} without licence`} />
        </>
      }
      title="Hospital directory"
      icon={<Building2 size={16} />}
      rows={rows}
      total={items.length}
      loading={isLoading}
      searchPlaceholder="Search name, licence, address or owner…"
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
      empty={{ icon: <Building2 size={19} />, title: "No hospitals yet", body: "Hospitals appear here once a hospital admin registers and is approved." }}
    />
  );
}
