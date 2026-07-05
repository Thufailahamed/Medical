"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/portal/lib/api";
import { useAuthStore, type ActiveTenant } from "@/portal/stores/auth";
import { cn } from "@/portal/lib/utils";
import { useT } from "@/portal/i18n";

interface Tenant {
  type: "hospital" | "clinic";
  id: string;
  name: string;
  role: string;
}

interface MeTenantsResponse {
  hospitals: Array<{ id: string; name: string; role: string }>;
  clinics: Array<{ id: string; name: string; role: string; ownershipPct: number }>;
}

/**
 * Topbar tenant switcher. Calls /me/tenants to list every hospital and
 * clinic the doctor is associated with, and writes the active pick into
 * the auth store so the api wrapper sends the right x-active-* header.
 *
 * The "None" option clears the header — useful when the doctor wants
 * cross-tenant queries (their global care-team, etc).
 */
export function TenantSwitcher() {
  const t = useT();
  const token = useAuthStore((s) => s.token);
  const active = useAuthStore((s) => s.activeTenant);
  const setActiveTenant = useAuthStore((s) => s.setActiveTenant);
  const clearActiveTenant = useAuthStore((s) => s.clearActiveTenant);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const { data } = useQuery({
    queryKey: ["me", "tenants"],
    queryFn: () => api<MeTenantsResponse>("/me/tenants"),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const hospitals: Tenant[] = (data?.hospitals ?? []).map((h) => ({
    type: "hospital",
    id: h.id,
    name: h.name,
    role: h.role,
  }));
  const clinics: Tenant[] = (data?.clinics ?? []).map((c) => ({
    type: "clinic",
    id: c.id,
    name: c.name,
    role: c.role,
  }));
  const all: Tenant[] = [...hospitals, ...clinics];

  const current =
    active && all.find((x) => x.type === active.type && x.id === active.id);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-8 inline-flex items-center gap-2 px-2.5 rounded-md border border-border bg-surface text-xs text-text focus-ring hover:bg-surface-2"
        )}
      >
        <Building2 size={14} className="text-text-muted" />
        <span className="max-w-[160px] truncate">
          {current ? current.name : t("shell.tenantNone")}
        </span>
        <ChevronsUpDown size={12} className="text-text-muted" />
      </button>

      {open ? (
        <div className="absolute right-0 mt-1 w-72 rounded-md border border-border bg-surface shadow-[var(--shadow-md)] z-30 overflow-hidden">
          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-text-muted border-b border-border">
            {t("shell.tenant")}
          </div>

          <button
            type="button"
            onClick={() => {
              clearActiveTenant();
              setOpen(false);
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-xs hover:bg-surface-2 flex items-center justify-between gap-2"
            )}
          >
            <span>{t("shell.tenantNone")}</span>
            {!active ? <Check size={14} className="text-brand" /> : null}
          </button>

          {hospitals.length > 0 ? (
            <div className="border-t border-border">
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-text-muted">
                Hospitals
              </div>
              {hospitals.map((h) => (
                <TenantRow
                  key={`h_${h.id}`}
                  tenant={h}
                  selected={active?.type === "hospital" && active.id === h.id}
                  onPick={(t) => {
                    setActiveTenant(t);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          ) : null}

          {clinics.length > 0 ? (
            <div className="border-t border-border">
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-text-muted">
                Clinics
              </div>
              {clinics.map((c) => (
                <TenantRow
                  key={`c_${c.id}`}
                  tenant={c}
                  selected={active?.type === "clinic" && active.id === c.id}
                  onPick={(t) => {
                    setActiveTenant(t);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          ) : null}

          {all.length === 0 ? (
            <div className="px-3 py-3 text-xs text-text-muted">
              No tenant memberships yet.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TenantRow({
  tenant,
  selected,
  onPick,
}: {
  tenant: Tenant;
  selected: boolean;
  onPick: (t: ActiveTenant) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick({ type: tenant.type, id: tenant.id })}
      className="w-full text-left px-3 py-2 text-xs hover:bg-surface-2 flex items-center justify-between gap-2"
    >
      <div className="min-w-0">
        <div className="text-text truncate">{tenant.name}</div>
        <div className="text-text-muted capitalize">
          {tenant.type} · {tenant.role.replace(/_/g, " ")}
        </div>
      </div>
      {selected ? <Check size={14} className="text-brand" /> : null}
    </button>
  );
}