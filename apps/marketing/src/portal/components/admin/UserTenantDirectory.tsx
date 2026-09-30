"use client";

/**
 * Directory page for tenants that are backed by a single user account
 * (pharmacies, laboratories, ambulance operators, insurers).
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, CheckCircle2, Clock, Hash, Mail, MapPin, Phone, UserCheck, Users } from "lucide-react";

import { Pill } from "@/portal/components/ui/Pill";
import { adminApi } from "@/portal/lib/admin-api";
import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  AdminDirectory,
  OrgTile,
  humanize,
  statusRail,
  statusTone,
  withinDays,
  type DirectoryRow,
} from "@/portal/components/admin/AdminDirectory";

export type TenantUserRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  licenseNumber?: string | null;
  city?: string | null;
  address?: string | null;
};

type Filter = "all" | "active" | "pending" | "other";

export function UserTenantDirectory({
  queryKey,
  endpoint,
  kicker,
  title,
  titleAccent,
  description,
  noun,
  plural,
  icon,
  tileTone,
  rowActions,
  children,
}: {
  queryKey: readonly unknown[];
  endpoint: string;
  kicker: string;
  title: string;
  titleAccent: string;
  description: string;
  /** Singular noun, e.g. "pharmacy". */
  noun: string;
  /** Plural used in labels; defaults to the lower-cased title. */
  plural?: string;
  icon: (size: number) => React.ReactNode;
  /** Gradient + glow for the row tile, e.g. "from-emerald-500 to-teal-600 shadow-emerald-500/30". */
  tileTone: string;
  /** Per-row actions (e.g. approve / reject on pending labs). */
  rowActions?: (row: TenantUserRow) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const many = plural ?? title.toLowerCase();
  const [filter, setFilter] = useState<Filter>("all");
  const [now] = useState(() => Date.now());

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => adminApi<{ items: TenantUserRow[]; total: number }>(endpoint),
  });

  const items = data?.items ?? [];
  const active = items.filter((r) => r.status === "active").length;
  const pending = items.filter((r) => statusTone(r.status) === "warn").length;
  const other = items.length - active - pending;
  const recent = items.filter((r) => withinDays(r.createdAt, 30, now)).length;

  const filtered = items.filter((r) =>
    filter === "active"
      ? r.status === "active"
      : filter === "pending"
        ? statusTone(r.status) === "warn"
        : filter === "other"
          ? r.status !== "active" && statusTone(r.status) !== "warn"
          : true,
  );

  const rows: DirectoryRow[] = filtered.map((r) => ({
    id: r.id,
    name: r.name,
    href: `/admin/users/${r.id}`,
    leading: <OrgTile icon={icon(17)} tone={tileTone} />,
    accent: statusRail(r.status),
    badges: <Pill tone={statusTone(r.status)}>{humanize(r.status)}</Pill>,
    meta: [
      ...(r.email ? [{ icon: <Mail size={11} />, text: r.email }] : []),
      ...(r.phone ? [{ icon: <Phone size={11} />, text: r.phone, wide: true }] : []),
      ...(r.licenseNumber ? [{ icon: <Hash size={11} />, text: r.licenseNumber, mono: true, wide: true }] : []),
      ...(r.city || r.address ? [{ icon: <MapPin size={11} />, text: r.city || r.address, wide: true }] : []),
      { icon: <CalendarPlus size={11} />, text: `Joined ${new Date(r.createdAt).toLocaleDateString()}`, wide: true },
    ],
    searchText: [r.email, r.phone, r.licenseNumber, r.city, r.address].filter(Boolean).join(" "),
    actions: rowActions?.(r),
  }));

  return (
    <AdminDirectory<Filter>
      hero={
        <DoctorHero
          kickerIcon={icon(13)}
          kicker={kicker}
          kickerMeta={`${items.length} registered`}
          title={
            <>
              {title}{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                {titleAccent}
              </span>
            </>
          }
          description={description}
          chips={
            <>
              <span className={HERO_CHIP}>
                <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                {active} active
              </span>
              {pending > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilter("pending")}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
                >
                  <Clock size={12} aria-hidden />
                  {pending} awaiting approval
                </button>
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
          <StatTile
            label={`All ${many}`}
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : String(items.length)}
            sub="Registered accounts"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <StatTile
            label="Active"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(active)}
            sub="Live on the platform"
            progress={items.length ? Math.round((active / items.length) * 100) : null}
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <StatTile
            label="Pending"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(pending)}
            sub={pending ? "Awaiting review" : "Nothing to review"}
            pulse={pending > 0}
            badge={pending ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={filter === "pending"}
            onClick={() => setFilter("pending")}
          />
          <StatTile
            label="Joined · 30 days"
            icon={<CalendarPlus size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(recent)}
            sub="New sign-ups"
          />
        </>
      }
      title={`${humanize(noun)} directory`}
      icon={icon(16)}
      rows={rows}
      total={items.length}
      loading={isLoading}
      searchPlaceholder="Search name, email, phone or licence…"
      segmented={{
        value: filter,
        onChange: setFilter,
        options: [
          { value: "all", label: "All", count: items.length },
          { value: "active", label: "Active", count: active },
          { value: "pending", label: "Pending", count: pending },
          { value: "other", label: "Suspended", count: other },
        ],
      }}
      empty={{
        icon: icon(19),
        title: `No ${many} yet`,
        body: `New ${noun} accounts appear here once they register and are approved.`,
      }}
    >
      {children}
    </AdminDirectory>
  );
}
