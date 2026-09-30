"use client";

import { useQuery } from "@tanstack/react-query";
import { Building, Building2, MapPin, Phone, Hospital, Stethoscope, ShieldCheck, Lock } from "lucide-react";

import { api } from "@/portal/lib/api";
import { RoleGate } from "@/portal/lib/rbac";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  RowAccent,
  StatTile,
} from "@/portal/components/doctor/Workspace";

interface Tenant {
  id: string;
  name: string;
  type: "hospital" | "clinic";
  address: string | null;
  phone: string | null;
  specialties: string[] | null;
  role: string;
}

interface TenantsResponse {
  hospitals: Tenant[];
  clinics: Tenant[];
  activeHospitalId: string | null;
  activeClinicId: string | null;
}

// Tenant roster is admin-only. Patients and doctors see no value here —
// the backend /me/tenants endpoint returns their own memberships, but
// the page UI is geared at super_admin / hospital_admin pickers.
const TENANT_VIEW_ROLES = [
  "super_admin",
  "hospital_admin",
  "hospital_staff",
] as const;

function humanize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TenantsPage() {
  const t = useT();

  const { data, isLoading } = useQuery({
    queryKey: ["me", "tenants"],
    queryFn: () => api<TenantsResponse>("/me/tenants"),
  });

  const hospitals = data?.hospitals ?? [];
  const clinics = data?.clinics ?? [];
  const specialties = new Set(hospitals.flatMap((h) => h.specialties ?? []));
  const activeName =
    hospitals.find((h) => h.id === data?.activeHospitalId)?.name ??
    clinics.find((c) => c.id === data?.activeClinicId)?.name ??
    null;

  return (
    <RoleGate
      allow={[...TENANT_VIEW_ROLES]}
      fallback={
        <div className="mx-auto w-full max-w-[1400px]">
          <div className={PANEL}>
            <EmptyBlock
              className="mt-0"
              icon={<Lock size={19} />}
              title={t("common.noAccess")}
              body="The tenant roster is available to hospital administrators and staff."
            />
          </div>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
        <div>
          <DoctorHero
            kickerIcon={<Building size={13} aria-hidden />}
            kicker="Organisations"
            kickerMeta={`${hospitals.length + clinics.length} membership${hospitals.length + clinics.length === 1 ? "" : "s"}`}
            title={
              <>
                {t("tenants.title")}{" "}
                <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                  &amp; workspaces
                </span>
              </>
            }
            description={t("tenants.subtitle")}
            chips={
              activeName ? (
                <span className={HERO_CHIP}>
                  <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                  Active: {activeName}
                </span>
              ) : undefined
            }
          />

          <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile label={t("tenants.hospitals")} icon={<Hospital size={16} />} tone="bg-sky-50 text-sky-600" value={isLoading ? "…" : String(hospitals.length)} sub="Hospital memberships" />
            <StatTile label={t("tenants.clinics")} icon={<Building2 size={16} />} tone="bg-violet-50 text-violet-600" value={isLoading ? "…" : String(clinics.length)} sub="Clinic memberships" />
            <StatTile label="Specialties" icon={<Stethoscope size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(specialties.size)} sub="Across hospitals" />
            <StatTile label="Active workspace" icon={<ShieldCheck size={16} />} tone="bg-amber-50 text-amber-600" value={activeName ? "1" : "—"} sub={activeName ?? "None selected"} />
          </HeroOverlap>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <TenantPanel
            id="tn-hosp"
            title={t("tenants.hospitals")}
            icon={<Hospital size={16} />}
            tone="bg-sky-50 text-sky-600"
            tile="from-sky-500 to-cyan-600 shadow-sky-500/30"
            accent="bg-sky-500"
            items={hospitals}
            activeId={data?.activeHospitalId ?? null}
            loading={isLoading}
            empty={t("tenants.noHospitals")}
          />
          <TenantPanel
            id="tn-clinic"
            title={t("tenants.clinics")}
            icon={<Building2 size={16} />}
            tone="bg-violet-50 text-violet-600"
            tile="from-violet-500 to-purple-600 shadow-violet-500/30"
            accent="bg-violet-500"
            items={clinics}
            activeId={data?.activeClinicId ?? null}
            loading={isLoading}
            empty={t("tenants.noClinics")}
          />
        </div>
      </div>
    </RoleGate>
  );
}

function TenantPanel({
  id,
  title,
  icon,
  tone,
  tile,
  accent,
  items,
  activeId,
  loading,
  empty,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  tone: string;
  tile: string;
  accent: string;
  items: Tenant[];
  activeId: string | null;
  loading: boolean;
  empty: string;
}) {
  return (
    <section className={cn(PANEL, "min-w-0")} aria-labelledby={id}>
      <PanelHeader id={id} icon={icon} tone={tone} title={title} caption={`${items.length} total`} />
      {loading ? (
        <div className="mt-5 space-y-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyBlock icon={icon} title={empty} body="Memberships granted by an administrator will appear here." />
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((h) => {
            const active = h.id === activeId;
            return (
              <li key={h.id} className={cn(LIST_ROW, "hover:translate-y-0 sm:items-start", active && "bg-emerald-50/40")}>
                <RowAccent className={active ? "bg-emerald-500" : accent} />
                <div className="flex min-w-0 flex-1 items-start gap-3.5 pl-1.5">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br text-white shadow-sm", tile)}>
                    <Building2 size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{h.name}</span>
                      {active ? (
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">Active</span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      {h.address ? (
                        <span className="flex min-w-0 items-center gap-1 truncate">
                          <MapPin size={11} />
                          {h.address}
                        </span>
                      ) : null}
                      {h.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone size={11} />
                          {h.phone}
                        </span>
                      ) : null}
                    </div>
                    {h.specialties && h.specialties.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {h.specialties.slice(0, 4).map((s, i) => (
                          <span key={i} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600">
                            {s}
                          </span>
                        ))}
                        {h.specialties.length > 4 ? (
                          <span className="text-[10.5px] font-semibold text-slate-400">+{h.specialties.length - 4}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 self-start rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 sm:self-center">
                  {humanize(h.role)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
