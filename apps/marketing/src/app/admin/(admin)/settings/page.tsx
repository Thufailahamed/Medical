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
        icon={<SettingsIcon size={20} className="text-amber-600" />}
        actions={
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 text-xs text-text-soft hover:text-amber-700"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        }
      />

      {isLoading ? (
        <p className="text-text-soft text-sm">Loading settings…</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">
          Failed to load settings.
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center">
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
              className="bg-surface border border-border rounded-2xl"
            >
              <button
                onClick={() => setOpen((o) => ({ ...o, [category]: !isOpen }))}
                className="w-full flex items-center gap-2 p-5 text-left"
              >
                {isOpen ? (
                  <ChevronDown size={16} className="text-amber-600" />
                ) : (
                  <ChevronRight size={16} className="text-amber-600" />
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

      <section className="bg-surface border border-border rounded-2xl p-5">
        <PasskeyManager />
      </section>
    </div>
  );
}