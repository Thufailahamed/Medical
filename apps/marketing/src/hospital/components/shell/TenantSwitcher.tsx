"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Hospital } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/hospital/lib/api";
import { useAuthStore, type ActiveTenant } from "@/hospital/stores/auth";
import { cn } from "@/hospital/lib/utils";
import { useT } from "@/hospital/i18n";

interface Tenant {
  type: "hospital" | "clinic";
  id: string;
  name: string;
  role: string | null;
}

interface MeTenantsResponse {
  hospitals: Array<{ id: string; name: string; role: string }>;
  clinics: Array<{ id: string; name: string; role: string }>;
}

/**
 * Hospital portal tenant switcher. Calls /me/tenants to list every
 * hospital and clinic the user is associated with, then writes the
 * active pick into the auth store so `lib/api` sends the matching
 * x-active-* header. The "None" entry clears the header — used for
 * cross-tenant reads by super_admin.
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
          "h-10 inline-flex items-center gap-2 px-3 rounded-xl border text-xs font-semibold transition-all duration-200",
          open
            ? "bg-white border-brand/30 ring-2 ring-brand/10 text-text shadow-sm"
            : "bg-transparent border-transparent text-text-soft hover:bg-surface-2/60 hover:border-border/40 hover:text-text"
        )}
        aria-label="Switch facility"
      >
        <Building2 size={14} className={cn("transition-colors", open ? "text-brand" : "text-text-muted")} />
        <span className="max-w-[140px] truncate">
          {current ? current.name : t("shell.switchTenant")}
        </span>
        <ChevronsUpDown
          size={12}
          className={cn(
            "transition-transform duration-200",
            open ? "text-brand rotate-180" : "text-text-muted"
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-72 rounded-xl border border-border/80 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] z-30 overflow-hidden animate-in">
          <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted border-b border-border/60 bg-surface-2/30">
            {t("shell.switchTenant")}
          </div>

          <button
            type="button"
            onClick={() => {
              clearActiveTenant();
              setOpen(false);
            }}
            className={cn(
              "w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-surface-2/60 flex items-center justify-between gap-2 transition-colors",
              !active && "bg-sky-50/40"
            )}
          >
            <span className="text-text-soft">— None —</span>
            {!active && (
              <span className="h-5 w-5 rounded-full bg-sky-100 flex items-center justify-center">
                <Check size={12} className="text-sky-600" />
              </span>
            )}
          </button>

          {hospitals.length > 0 && (
            <div className="border-t border-border/60">
              <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted flex items-center gap-1.5">
                <Hospital size={10} />
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
          )}

          {clinics.length > 0 && (
            <div className="border-t border-border/60">
              <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted flex items-center gap-1.5">
                <Building2 size={10} />
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
          )}

          {all.length === 0 && (
            <div className="px-4 py-4 text-xs text-text-muted text-center">
              {t("shell.noTenants")}
            </div>
          )}
        </div>
      )}
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
      className={cn(
        "w-full text-left px-4 py-2.5 text-xs hover:bg-surface-2/60 flex items-center justify-between gap-2 transition-colors",
        selected && "bg-sky-50/40"
      )}
    >
      <div className="min-w-0">
        <div className={cn("text-[13px] font-medium truncate", selected ? "text-text" : "text-text-soft")}>
          {tenant.name}
        </div>
        <div className="text-[10px] text-text-muted capitalize mt-0.5 flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-muted/40" />
          {tenant.type}{tenant.role ? ` · ${tenant.role.replace(/_/g, " ")}` : ""}
        </div>
      </div>
      {selected && (
        <span className="h-5 w-5 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
          <Check size={12} className="text-sky-600" />
        </span>
      )}
    </button>
  );
}