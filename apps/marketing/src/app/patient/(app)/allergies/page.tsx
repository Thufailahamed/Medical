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
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        icon: AlertCircle,
      };
    case "severe":
      return {
        label: "Severe Reaction",
        bg: "bg-orange-50 text-orange-700 border-orange-200",
        icon: AlertTriangle,
      };
    case "moderate":
      return {
        label: "Moderate",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: AlertTriangle,
      };
    case "mild":
    default:
      return {
        label: "Mild",
        bg: "bg-sky-50 text-sky-700 border-sky-200",
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
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <ShieldAlert size={12} className="text-rose-300" />
                Clinical Safety &amp; EHR Registry
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Allergies &amp; Adverse Drug Reactions
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Document confirmed drug, food, and environmental allergens to protect clinical decision-making and prevent contraindicated prescriptions.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/ai"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Bot size={13} />
                <span>Drug Interaction AI</span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <Plus size={14} className="text-sky-700" />
                <span>Add Known Allergy</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "all"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <ShieldAlert size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Total Allergens
                </p>
                <p className="text-base font-extrabold text-white">
                  {rawList.length}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("critical")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "critical"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-rose-400/30 flex items-center justify-center text-rose-200 shrink-0">
                <AlertCircle size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-rose-200 truncate">
                  Critical / Severe
                </p>
                <p className="text-base font-extrabold text-white">
                  {criticalCount}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("moderate")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "moderate"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Mild / Moderate
                </p>
                <p className="text-base font-extrabold text-white">
                  {moderateCount}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Safety System
                </p>
                <p className="text-base font-extrabold text-white">EHR Protected</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Filter Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "all"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            All ({rawList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("critical")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "critical"
                ? "bg-white text-rose-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <span>Critical &amp; Severe</span>
            {criticalCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                {criticalCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("moderate")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "moderate"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Mild / Moderate ({moderateCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search substance, reaction, or notes..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredAllergies.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                <ShieldCheck size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {search ? "No allergies match your search" : "No Known Allergies Recorded"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
                  {search
                    ? `No allergen found matching "${search}". Clear search to view full list.`
                    : "No drug, food, or environmental sensitivities are flagged on your chart. Adding your known reactions helps doctors avoid prescribing contraindicated medications during consultations."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                <Plus size={14} />
                <span>+ Record Known Allergy</span>
              </button>
            </div>

            {/* Quick Presets for Common Allergies */}
            {!search && (
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Common Allergens (1-Tap Fast Record)
                  </h4>
                  <span className="text-[11px] text-slate-400">Click to add to record</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {COMMON_PRESETS.map((preset) => (
                    <button
                      key={preset.substance}
                      type="button"
                      onClick={() => handleQuickAdd(preset)}
                      disabled={add.isPending}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition-all text-left flex items-start justify-between gap-2 group cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-rose-700 transition-colors truncate">
                          {preset.substance}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {preset.reaction}
                        </p>
                      </div>
                      <Plus
                        size={14}
                        className="text-slate-400 group-hover:text-rose-600 transition-colors shrink-0 mt-0.5"
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
                  className="group p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-rose-300 transition-all flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="h-11 w-11 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-100 shadow-2xs group-hover:scale-105 transition-transform">
                      <ShieldAlert size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-rose-700 transition-colors truncate">
                          {allergy.substance}
                        </h3>

                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border",
                            badge.bg,
                          )}
                        >
                          <BadgeIcon size={11} />
                          <span>{badge.label}</span>
                        </span>
                      </div>

                      {allergy.reaction ? (
                        <p className="text-xs text-slate-700 font-semibold mt-1">
                          Reaction: <span className="font-medium text-slate-600">{allergy.reaction}</span>
                        </p>
                      ) : null}

                      {allergy.notes ? (
                        <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-2">
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
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
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
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
            <QrCode size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Synced with Emergency Card &amp; QR Pass
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Confirmed critical allergies are automatically projected to your Emergency Medical ID for first responders and ER clinicians.
            </p>
          </div>
        </div>

        <Link
          href="/patient/emergency-card"
          className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <ExternalLink size={13} className="text-amber-700" />
          <span>View Emergency Card</span>
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
