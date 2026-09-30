"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Hash,
  Hospital,
  LogIn,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Tag,
  UserRound,
} from "lucide-react";

import { Pill } from "@/portal/components/ui/Pill";
import { adminApi } from "@/portal/lib/admin-api";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { InfoField, humanize, statusTone } from "@/portal/components/admin/AdminDirectory";

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
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const [now] = useState(() => Date.now());
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "tenant", type, id],
    queryFn: () => adminApi<{ type: string; tenant: Tenant }>(`/admin/tenants/${type}/${id}`),
  });

  const isClinic = (data?.type ?? type) === "clinic";
  const listHref = isClinic ? "/admin/clinics" : "/admin/hospitals";
  const listLabel = isClinic ? "clinics" : "hospitals";

  const back = (
    <Link
      href={listHref}
      className="group inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
    >
      <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" aria-hidden />
      Back to {listLabel}
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6" role="status" aria-label="Loading">
        {back}
        <div className="h-56 animate-pulse rounded-[20px] bg-slate-200/70" />
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100 xl:col-span-8" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100 xl:col-span-4" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 [&_a:hover]:no-underline">
        {back}
        <div className={PANEL}>
          <EmptyBlock
            className="mt-0"
            icon={<Building2 size={19} />}
            title={`${isClinic ? "Clinic" : "Hospital"} not found`}
            body="It may have been removed, or the link is out of date."
            actions={
              <Link
                href={listHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
              >
                View all {listLabel}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const t = data.tenant;
  const typeLabel = isClinic ? "Clinic" : "Hospital";
  const TypeIcon = isClinic ? Hospital : Building2;
  const ageDays = Math.max(0, Math.floor((now - Date.parse(t.createdAt)) / 86_400_000));
  const ownerActive = t.ownerStatus === "active";
  const mapsHref = t.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address)}` : null;

  // A simple completeness score for the tenant profile.
  const checks = [
    { label: "Licence number", ok: !!t.license },
    { label: "Street address", ok: !!t.address },
    { label: "Contact phone", ok: !!t.phone },
    ...(isClinic ? [{ label: "Short code", ok: !!t.shortCode }] : []),
    { label: "Owner account active", ok: ownerActive },
  ];
  const completePct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {back}

      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          leading={
            <span
              className={cn(
                "grid h-[76px] w-[76px] place-items-center rounded-[20px] bg-gradient-to-br text-white ring-1 ring-inset ring-white/25",
                isClinic
                  ? "from-violet-400 to-purple-600 shadow-[0_12px_32px_-8px_rgba(139,92,246,0.6)]"
                  : "from-sky-400 to-blue-600 shadow-[0_12px_32px_-8px_rgba(14,165,233,0.6)]",
              )}
            >
              <TypeIcon size={32} strokeWidth={1.75} />
            </span>
          }
          kickerIcon={<TypeIcon size={13} aria-hidden />}
          kicker={`${typeLabel} tenant`}
          kickerMeta={t.shortCode ? `Code ${t.shortCode}` : `Since ${new Date(t.createdAt).toLocaleDateString()}`}
          title={t.name}
          description={t.address || "No address on file"}
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className={cn("h-2 w-2 rounded-full", ownerActive ? "bg-emerald-400" : "bg-amber-400")} aria-hidden />
                Owner {humanize(t.ownerStatus).toLowerCase()}
              </span>
              {t.license ? (
                <span className={cn(HERO_CHIP, "font-mono")}>
                  <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                  {t.license}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <ShieldCheck size={12} aria-hidden />
                  No licence on file
                </span>
              )}
              {t.rating != null ? (
                <span className={HERO_CHIP}>
                  <Star size={12} className="text-amber-300" fill="currentColor" aria-hidden />
                  {t.rating.toFixed(1)}
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              {t.phone ? (
                <a href={`tel:${t.phone}`} className={HERO_GHOST}>
                  <Phone size={15} aria-hidden />
                  Call
                </a>
              ) : null}
              <Link href={`/admin/users/${t.ownerUserId}`} className={HERO_PRIMARY}>
                <UserRound size={15} className="text-sky-600" aria-hidden />
                Owner record
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Owner status"
            icon={<UserRound size={16} />}
            tone={ownerActive ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}
            value={humanize(t.ownerStatus)}
            sub={ownerActive ? "Admin account is live" : "Owner needs attention"}
            pulse={!ownerActive}
          />
          <StatTile
            label="Rating"
            icon={<Star size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={t.rating != null ? t.rating.toFixed(1) : "—"}
            unit={t.rating != null ? "/ 5" : undefined}
            sub={t.rating != null ? "Patient reviews" : "No ratings yet"}
            progress={t.rating != null ? Math.round((t.rating / 5) * 100) : null}
          />
          <StatTile
            label="Profile complete"
            icon={<BadgeCheck size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={`${completePct}%`}
            sub={`${checks.filter((c) => c.ok).length} of ${checks.length} checks`}
            progress={completePct}
          />
          <StatTile
            label="On platform"
            icon={<CalendarDays size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(ageDays)}
            unit={ageDays === 1 ? "day" : "days"}
            sub={`Created ${new Date(t.createdAt).toLocaleDateString()}`}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* Facility details */}
          <section className={PANEL} aria-labelledby="tn-facility">
            <PanelHeader
              id="tn-facility"
              icon={<TypeIcon size={16} />}
              tone={isClinic ? "bg-violet-50 text-violet-600" : "bg-sky-50 text-sky-600"}
              title={`${typeLabel} details`}
              caption="Registration and contact"
            />
            <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoField icon={<ShieldCheck size={15} />} label="Licence number" mono copyValue={t.license}>
                {t.license || <span className="text-slate-400">Not provided</span>}
              </InfoField>
              <InfoField icon={<Phone size={15} />} label="Phone" copyValue={t.phone}>
                {t.phone ? (
                  <a href={`tel:${t.phone}`} className="text-slate-900 hover:text-sky-700">{t.phone}</a>
                ) : (
                  <span className="text-slate-400">Not provided</span>
                )}
              </InfoField>
              {t.shortCode !== undefined ? (
                <InfoField icon={<Tag size={15} />} label="Short code" mono copyValue={t.shortCode}>
                  {t.shortCode || <span className="text-slate-400">Not set</span>}
                </InfoField>
              ) : null}
              <InfoField icon={<CalendarDays size={15} />} label="Created">
                {new Date(t.createdAt).toLocaleString()}
              </InfoField>
              <InfoField icon={<Hash size={15} />} label="Tenant ID" mono copyValue={t.id}>
                {t.id}
              </InfoField>
            </dl>

            {/* Address card */}
            <div className="mt-2.5 flex items-start gap-3 rounded-xl bg-gradient-to-br from-slate-50 to-sky-50/40 p-4 ring-1 ring-inset ring-slate-900/5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-white text-sky-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                <MapPin size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400">Address</p>
                <p className="mt-0.5 text-sm font-medium leading-relaxed text-slate-900">{t.address || "No address on file"}</p>
              </div>
              {mapsHref ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-sky-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] transition-colors hover:bg-sky-50"
                >
                  Open map
                  <ChevronRight size={13} />
                </a>
              ) : null}
            </div>
          </section>

          {/* Profile checklist */}
          <section className={PANEL} aria-labelledby="tn-checks">
            <PanelHeader
              id="tn-checks"
              icon={<BadgeCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Compliance checklist"
              caption={completePct === 100 ? "Everything is in place" : "Items to follow up with the owner"}
              action={
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    completePct === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                  )}
                >
                  {completePct}%
                </span>
              }
            />
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <span
                className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
                style={{ width: `${completePct}%` }}
              />
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px]",
                    c.ok ? "bg-emerald-50/60 text-slate-700" : "bg-amber-50/70 text-amber-900",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full text-white",
                      c.ok ? "bg-emerald-500" : "bg-amber-400",
                    )}
                  >
                    {c.ok ? <Check size={12} strokeWidth={3} /> : <span className="text-[11px] font-bold">!</span>}
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Owner ────────────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-4 xl:col-span-4" aria-label="Owner">
          <section className={PANEL} aria-labelledby="tn-owner">
            <PanelHeader id="tn-owner" icon={<UserRound size={16} />} tone="bg-slate-100 text-slate-700" title="Owner" caption={`${typeLabel} administrator account`} />
            <div className="mt-5 flex items-center gap-3.5">
              <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-lg font-semibold text-white shadow-lg shadow-sky-500/25">
                {t.ownerName
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()}
                <span
                  className={cn("absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-white", ownerActive ? "bg-emerald-500" : "bg-amber-400")}
                  aria-hidden
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-slate-900">{t.ownerName}</p>
                <div className="mt-1">
                  <Pill tone={statusTone(t.ownerStatus)}>{humanize(t.ownerStatus)}</Pill>
                </div>
              </div>
            </div>

            <ul className="mt-5 flex flex-col gap-0.5 text-[13px]">
              <li className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2">
                <Mail size={15} className="shrink-0 text-slate-400" />
                <a href={`mailto:${t.ownerEmail}`} className="min-w-0 truncate text-slate-700 hover:text-sky-700">
                  {t.ownerEmail}
                </a>
              </li>
              <li className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2">
                <LogIn size={15} className="shrink-0 text-slate-400" />
                <span className="text-slate-700">
                  {t.ownerLastLoginAt ? (
                    <>
                      Last login <span className="font-medium text-slate-900">{relativeTime(t.ownerLastLoginAt)}</span>
                    </>
                  ) : (
                    "Never signed in"
                  )}
                </span>
              </li>
              {t.ownerLastLoginAt ? (
                <li className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2">
                  <Clock3 size={15} className="shrink-0 text-slate-400" />
                  <span className="text-slate-500">{new Date(t.ownerLastLoginAt).toLocaleString()}</span>
                </li>
              ) : null}
            </ul>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <a
                href={`mailto:${t.ownerEmail}`}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700"
              >
                <Mail size={14} />
                Email
              </a>
              <Link
                href={`/admin/users/${t.ownerUserId}`}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#07233a] text-xs font-semibold text-white transition-colors hover:bg-sky-700"
              >
                Full record
                <ChevronRight size={14} />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
