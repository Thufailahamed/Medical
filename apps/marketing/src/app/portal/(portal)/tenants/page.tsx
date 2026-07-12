"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Phone } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { RoleGate } from "@/portal/lib/rbac";
import { useT } from "@/portal/i18n";

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

export default function TenantsPage() {
  const t = useT();

  const { data, isLoading } = useQuery({
    queryKey: ["me", "tenants"],
    queryFn: () => api<TenantsResponse>("/me/tenants"),
  });

  const hospitals = data?.hospitals ?? [];
  const clinics = data?.clinics ?? [];

  return (
    <RoleGate
      allow={[...TENANT_VIEW_ROLES]}
      fallback={
        <div className="rounded-xl border border-border/60 bg-surface-1 p-6 text-sm text-text-soft">
          {t("common.noAccess")}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text">{t("tenants.title")}</h1>
          <p className="text-sm text-text-soft mt-1">{t("tenants.subtitle")}</p>
        </div>

      {/* Hospitals */}
      <Card>
        <CardHeader
          title={t("tenants.hospitals")}
          right={<Pill tone="brand">{hospitals.length}</Pill>}
        />
        {isLoading ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : hospitals.length === 0 ? (
          <Empty title={t("tenants.noHospitals")} className="mt-3" />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {hospitals.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-surface-2/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{h.name}</div>
                  <div className="flex items-center gap-2 text-xs text-text-soft">
                    {h.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={10} />
                        {h.address}
                      </span>
                    )}
                    {h.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} />
                        {h.phone}
                      </span>
                    )}
                  </div>
                  {h.specialties && h.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {h.specialties.slice(0, 3).map((s, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-surface-2 text-text-muted"
                        >
                          {s}
                        </span>
                      ))}
                      {h.specialties.length > 3 && (
                        <span className="text-[10px] text-text-muted">
                          +{h.specialties.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Pill tone="neutral">{h.role}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Clinics */}
      <Card>
        <CardHeader
          title={t("tenants.clinics")}
          right={<Pill tone="violet">{clinics.length}</Pill>}
        />
        {isLoading ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : clinics.length === 0 ? (
          <Empty title={t("tenants.noClinics")} className="mt-3" />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {clinics.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-surface-2/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-violet-soft text-violet flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{c.name}</div>
                  <div className="flex items-center gap-2 text-xs text-text-soft">
                    {c.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={10} />
                        {c.address}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} />
                        {c.phone}
                      </span>
                    )}
                  </div>
                </div>
                <Pill tone="neutral">{c.role}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </div>
    </RoleGate>
  );
}
