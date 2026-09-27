"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  ExternalLink,
  Info,
  Plus,
  QrCode,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { AllergyFormSheet } from "@/patient/components/allergies/AllergyFormSheet";
import { useAddAllergy, useAllergies, useDeleteAllergy } from "@/patient/hooks";
import type { AllergyRow } from "@/patient/types/patient";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";

const COMMON_PRESETS = [
  { substance: "Penicillin", severity: "critical" as const, reaction: "Anaphylaxis" },
  { substance: "Amoxicillin", severity: "severe" as const, reaction: "Hives & Swelling" },
  { substance: "Aspirin / NSAIDs", severity: "moderate" as const, reaction: "GI distress & Bronchospasm" },
  { substance: "Peanuts", severity: "critical" as const, reaction: "Anaphylaxis" },
  { substance: "Latex", severity: "moderate" as const, reaction: "Contact Dermatitis" },
  { substance: "Sulfa Antibiotics", severity: "severe" as const, reaction: "Severe Skin Rash" },
];

function getSeverityBadge(severity?: string | null) {
  switch (severity) {
    case "critical":
      return {
        label: "Critical (Anaphylactic)",
        bg: "bg-danger-soft text-danger",
        icon: AlertCircle,
      };
    case "severe":
      return {
        label: "Severe Reaction",
        bg: "bg-warn-soft text-warn",
        icon: AlertTriangle,
      };
    case "moderate":
      return {
        label: "Moderate",
        bg: "bg-warn-soft text-warn",
        icon: AlertTriangle,
      };
    case "mild":
    default:
      return {
        label: "Mild",
        bg: "bg-brand-soft text-brand",
        icon: Info,
      };
  }
}

export default function AllergiesPage() {
  const allergies = useAllergies();
  const add = useAddAllergy();
  const del = useDeleteAllergy();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "critical" | "moderate">("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rawList = allergies.data?.allergies ?? [];

  const { criticalCount, moderateCount } = useMemo(() => {
    let crit = 0;
    let mod = 0;
    for (const a of rawList) {
      if (a.severity === "critical" || a.severity === "severe") crit++;
      else mod++;
    }
    return { criticalCount: crit, moderateCount: mod };
  }, [rawList]);

  const filteredAllergies = useMemo(() => {
    let list = rawList;

    if (activeTab === "critical") {
      list = list.filter((a) => a.severity === "critical" || a.severity === "severe");
    } else if (activeTab === "moderate") {
      list = list.filter((a) => a.severity === "mild" || a.severity === "moderate");
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.substance.toLowerCase().includes(q) ||
          (a.reaction || "").toLowerCase().includes(q) ||
          (a.notes || "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [rawList, activeTab, search]);

  const handleQuickAdd = async (preset: typeof COMMON_PRESETS[0]) => {
    try {
      await add.mutateAsync({
        substance: preset.substance,
        severity: preset.severity,
        reaction: preset.reaction,
        notes: "Self-reported known allergen",
      });
    } catch (err) {
      console.error("Failed to add preset allergy", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to remove this allergy from your medical records?")) {
      setDeletingId(id);
      try {
        await del.mutateAsync(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<ShieldAlert size={13} aria-hidden />}
        kicker="Clinical Safety & EHR Registry"
        title="Allergies & Adverse Drug Reactions"
        description="Document confirmed drug, food, and environmental allergens to protect clinical decision-making and prevent contraindicated prescriptions."
        actions={
          <>
            <Link href="/patient/ai" className={heroSecondaryAction}>
              <Bot size={13} aria-hidden />
              Drug Interaction AI
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={heroPrimaryAction}
            >
              <Plus size={14} aria-hidden />
              Add Known Allergy
            </button>
          </>
        }
        footer={
          <>
            <span>Total Allergens · {rawList.length}</span>
            <span>Critical / Severe · {criticalCount}</span>
            <span>Mild / Moderate · {moderateCount}</span>
            <span>Safety System · EHR Protected</span>
          </>
        }
      />

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-xl border border-border shadow-card">
        {/* Filter Tabs */}
        <SegmentedTabs
          ariaLabel="Allergy filters"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as "all" | "critical" | "moderate")}
          tabs={[
            { id: "all", label: <>All ({rawList.length})</> },
            {
              id: "critical",
              label: (
                <>
                  <span>Critical &amp; Severe</span>
                  {criticalCount > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                      {criticalCount}
                    </span>
                  ) : null}
                </>
              ),
            },
            { id: "moderate", label: <>Mild / Moderate ({moderateCount})</> },
          ]}
        />

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search substance, reaction, or notes..."
            className="pt-input pl-9 pr-8 !h-9 text-xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 3. Allergies Feed ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {allergies.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredAllergies.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-card flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-success-soft text-success shrink-0 shadow-2xs" aria-hidden>
                <ShieldCheck size={28} />
              </div>
              <div className="flex-1">
                <h3 className="t-card-title text-text">
                  {search ? "No allergies match your search" : "No Known Allergies Recorded"}
                </h3>
                <p className="text-xs sm:text-sm text-text-soft mt-1 max-w-xl leading-relaxed">
                  {search
                    ? `No allergen found matching "${search}". Clear search to view full list.`
                    : "No drug, food, or environmental sensitivities are flagged on your chart. Adding your known reactions helps doctors avoid prescribing contraindicated medications during consultations."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(true)}
                className="pt-btn pt-btn-primary h-10 px-5 text-xs shrink-0"
              >
                <Plus size={14} aria-hidden />
                + Record Known Allergy
              </button>
            </div>

            {/* Quick Presets for Common Allergies */}
            {!search && (
              <div className="pt-4 border-t border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Common Allergens (1-Tap Fast Record)
                  </h4>
                  <span className="text-[11px] text-text-muted">Click to add to record</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {COMMON_PRESETS.map((preset) => (
                    <button
                      key={preset.substance}
                      type="button"
                      onClick={() => handleQuickAdd(preset)}
                      disabled={add.isPending}
                      className="p-3 rounded-xl bg-surface-2 border border-border hover:border-border-strong transition-all text-left flex items-start justify-between gap-2 group cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text group-hover:text-danger transition-colors truncate">
                          {preset.substance}
                        </p>
                        <p className="text-[11px] text-text-soft truncate">
                          {preset.reaction}
                        </p>
                      </div>
                      <Plus
                        size={14}
                        className="text-text-muted group-hover:text-danger transition-colors shrink-0 mt-0.5"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAllergies.map((allergy) => {
              const badge = getSeverityBadge(allergy.severity);
              const BadgeIcon = badge.icon;
              const isDeleting = deletingId === allergy.id;

              return (
                <article
                  key={allergy.id}
                  className="group p-4 sm:p-5 rounded-xl bg-surface border border-border shadow-card hover:shadow-md hover:border-border-strong transition-all flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="grid h-11 w-11 place-items-center rounded-md bg-danger-soft text-danger shrink-0 shadow-2xs transition-transform group-hover:scale-105" aria-hidden>
                      <ShieldAlert size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-text text-sm sm:text-base group-hover:text-danger transition-colors truncate">
                          {allergy.substance}
                        </h3>

                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                            badge.bg,
                          )}
                        >
                          <BadgeIcon size={11} aria-hidden />
                          <span>{badge.label}</span>
                        </span>
                      </div>

                      {allergy.reaction ? (
                        <p className="text-xs text-text font-semibold mt-1">
                          Reaction: <span className="font-medium text-text-soft">{allergy.reaction}</span>
                        </p>
                      ) : null}

                      {allergy.notes ? (
                        <p className="text-xs text-text-soft font-medium mt-0.5 line-clamp-2">
                          {allergy.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(allergy.id)}
                    disabled={isDeleting}
                    title="Remove allergy"
                    className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Emergency Health ID & Interaction Callout ───────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-warn-soft text-warn shrink-0" aria-hidden>
            <QrCode size={22} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              Synced with Emergency Card &amp; QR Pass
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              Confirmed critical allergies are automatically projected to your Emergency Medical ID for first responders and ER clinicians.
            </p>
          </div>
        </div>

        <Link
          href="/patient/emergency-card"
          className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
        >
          <ExternalLink size={13} aria-hidden />
          View Emergency Card
        </Link>
      </section>

      {/* ── 5. Add Allergy Form Sheet ───────────────────────────────────────── */}
      <AllergyFormSheet
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
