"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Phone, ChevronRight, Crown, PieChart, CalendarDays } from "lucide-react";

import { api } from "@/portal/lib/api";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  StatTile,
} from "@/portal/components/doctor/Workspace";

interface Clinic {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  role?: string;
  ownershipPct?: number;
  joinedAt?: string;
}

function humanize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClinicsPage() {
  const t = useT();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["clinics", "mine"],
    queryFn: () => api<Clinic[]>(`/clinics`),
  });

  const list = data ?? [];
  const owned = list.filter((c) => (c.ownershipPct ?? 0) > 0);
  const avgStake = owned.length ? Math.round(owned.reduce((a, c) => a + (c.ownershipPct ?? 0), 0) / owned.length) : 0;
  const earliest = list
    .map((c) => c.joinedAt)
    .filter(Boolean)
    .sort()[0];
  const term = q.trim().toLowerCase();
  const shown = list.filter(
    (c) => !term || [c.name, c.address, c.role].filter(Boolean).join(" ").toLowerCase().includes(term),
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <div>
        <DoctorHero
          kickerIcon={<Building2 size={13} aria-hidden />}
          kicker="Practice locations"
          kickerMeta={`${list.length} clinic${list.length === 1 ? "" : "s"}`}
          title={
            <>
              Your{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                clinics
              </span>
            </>
          }
          description={t("clinics.subtitle")}
          chips={
            owned.length > 0 ? (
              <span className={HERO_CHIP}>
                <Crown size={12} className="text-amber-300" aria-hidden />
                Partner in {owned.length}
              </span>
            ) : undefined
          }
          actions={
            <Link href="/portal/availability" className={HERO_GHOST}>
              <CalendarDays size={15} aria-hidden />
              Booking hours
            </Link>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Clinics"
            icon={<Building2 size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : String(list.length)}
            sub="Where you practise"
          />
          <StatTile
            label="Partnerships"
            icon={<Crown size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(owned.length)}
            sub={owned.length ? "With an ownership stake" : "No ownership stakes"}
          />
          <StatTile
            label="Average stake"
            icon={<PieChart size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={owned.length ? `${avgStake}%` : "—"}
            sub="Across partner clinics"
            progress={owned.length ? avgStake : null}
          />
          <StatTile
            label="Practising since"
            icon={<CalendarDays size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={earliest ? formatDate(earliest) : "—"}
            sub="Earliest affiliation"
          />
        </HeroOverlap>
      </div>

      <section className={PANEL} aria-labelledby="cl-list">
        <PanelHeader
          id="cl-list"
          icon={<Building2 size={16} />}
          tone="bg-sky-50 text-sky-600"
          title={t("clinics.title")}
          caption={isLoading ? "Loading…" : `${shown.length} of ${list.length} shown`}
        />
        {list.length > 3 ? (
          <PanelSearch className="mt-5" value={q} onChange={setQ} placeholder="Search clinic, address or role…" />
        ) : null}

        {isLoading ? (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyBlock
            icon={<Building2 size={19} />}
            title={list.length === 0 ? t("clinics.empty") : "No matching clinics"}
            body={
              list.length === 0
                ? "Ask a clinic admin to add you to their practice and it will show up here."
                : "Try another name or address."
            }
          />
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/portal/clinics/${c.id}`}
                  className="group flex h-full flex-col rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-16px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-sm shadow-sky-500/30">
                      <Building2 size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                        {c.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {c.role ? (
                          <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-700">
                            {humanize(c.role)}
                          </span>
                        ) : null}
                        {c.ownershipPct ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">
                            <Crown size={10} />
                            {c.ownershipPct}% owner
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-1.5 text-xs text-slate-500">
                    <span className="flex min-w-0 items-center gap-2">
                      <MapPin size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">{c.address || <span className="text-slate-300">No address</span>}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Phone size={12} className="shrink-0 text-slate-400" />
                      {c.phone || <span className="text-slate-300">No phone</span>}
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
                    <span className="text-slate-400">{c.joinedAt ? `Joined ${formatDate(c.joinedAt)}` : "Affiliated"}</span>
                    <span className="inline-flex items-center gap-0.5 font-semibold text-sky-700">
                      Open
                      <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
