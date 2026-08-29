"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Hospital, FlaskConical, Check, Loader2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api, ApiError } from "@/portal/lib/api";
import { useAuthStore } from "@/portal/stores/auth";

interface TenantSummary {
  id: string;
  name: string;
  type: "hospital" | "clinic" | "lab";
  role: string;
  logoUrl: string | null;
  isActive: boolean;
}

const ICONS: Record<TenantSummary["type"], React.ComponentType<{ size?: number; className?: string }>> = {
  hospital: Hospital,
  clinic: Building2,
  lab: FlaskConical,
};

export default function TenantsPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const query = useQuery<{ tenants: TenantSummary[] }>({
    queryKey: ["patient", "tenants"],
    queryFn: () => api<{ tenants: TenantSummary[] }>("/tenants/me"),
  });

  const switchTenant = useMutation({
    mutationFn: async (tenantId: string) => {
      await api(`/tenants/me/switch/${tenantId}`, { method: "POST" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "tenants"] });
      // Refresh /me so the active tenant updates
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Settings"
        title="Switch organization"
        description="If your account is linked to more than one hospital, clinic, or lab, you can switch between them here."
      />

      <Card>
        <QueryBoundary
          query={query}
          loadingCount={3}
          emptyTitle="No organizations"
          emptyDescription="Your account isn't linked to any hospital or clinic yet."
        >
          {(data) => {
            const list = data?.tenants ?? [];
            if (list.length === 0) {
              return (
                <p className="text-sm text-text-soft">
                  You only have one organization on file.
                </p>
              );
            }
            return (
              <ul className="flex flex-col gap-2">
                {list.map((t) => {
                  const Icon = ICONS[t.type];
                  return (
                    <li
                      key={t.id}
                      className={`flex items-center gap-3 rounded-inner border p-3 ${
                        t.isActive
                          ? "border-brand bg-brand-soft"
                          : "border-[color:var(--color-border)] bg-surface-1"
                      }`}
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-brand-soft text-brand">
                        <Icon size={16} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-text">
                          {t.name}
                        </h3>
                        <p className="text-xs text-text-soft">
                          {t.type} · {t.role}
                        </p>
                      </div>
                      {t.isActive ? (
                        <StatusPill tone="success" icon={<Check size={11} aria-hidden />}>
                          Active
                        </StatusPill>
                      ) : (
                        <button
                          type="button"
                          onClick={() => switchTenant.mutate(t.id)}
                          disabled={switchTenant.isPending}
                          className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {switchTenant.isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : null}
                          Switch
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}
