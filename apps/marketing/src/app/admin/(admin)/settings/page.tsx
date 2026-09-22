"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { SettingRow, type SettingItem } from "@/portal/components/admin/SettingRow";
import { PasskeyManager } from "@/portal/components/admin/PasskeyManager";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

const CATEGORY_LABEL: Record<string, string> = {
  registration: "Registration",
  uploads: "Uploads",
  operations: "Operations",
  feature_flags: "Feature flags",
};

export default function AdminSettingsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: adminQk.settings(),
    queryFn: () => adminApi<{ items: SettingItem[]; grouped: Record<string, SettingItem[]> }>("/admin/settings"),
  });

  // Collapse state per category — open by default.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <PageHeader
        title="System settings"
        subtitle="Runtime configuration. Changes take effect immediately."
        icon={<SettingsIcon size={20} className="text-blue-600" />}
        actions={
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 text-xs text-text-soft hover:text-blue-700"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-surface p-5 shadow-sm" role="status" aria-label="Loading">
          <div className="h-4 w-1/4 admin-shimmer rounded-md" />
          <div className="h-4 w-full admin-shimmer rounded-md" />
          <div className="h-4 w-5/6 admin-shimmer rounded-md" />
          <div className="h-4 w-2/3 admin-shimmer rounded-md" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">
          Failed to load settings.
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-surface p-10 text-center text-sm font-medium text-text-soft shadow-2xs">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-muted ring-1 ring-inset ring-border">
            <SettingsIcon size={18} aria-hidden />
          </div>
          <p className="text-text-soft">
            No settings found. Run the seed script to insert defaults.
          </p>
        </div>
      ) : (
        Object.entries(data.grouped).map(([category, items]) => {
          const isOpen = open[category] ?? true;
          return (
            <section
              key={category}
              className="portal-card bg-surface border border-border rounded-2xl"
            >
              <button
                onClick={() => setOpen((o) => ({ ...o, [category]: !isOpen }))}
                className="w-full flex items-center gap-2 p-5 text-left"
              >
                {isOpen ? (
                  <ChevronDown size={16} className="text-blue-600" />
                ) : (
                  <ChevronRight size={16} className="text-blue-600" />
                )}
                <div className="flex-1 text-left">
                  <SectionHeader title={CATEGORY_LABEL[category] ?? category} />
                  <p className="text-xs text-text-muted mt-0.5">
                    {items.length} setting{items.length === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
              {isOpen ? (
                <div className="px-5 pb-3">
                  {items.map((it) => (
                    <SettingRow key={it.key} item={it} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })
      )}

      <section className="portal-card bg-surface border border-border rounded-2xl p-5">
        <PasskeyManager />
      </section>
    </div>
  );
}