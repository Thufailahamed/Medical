"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Info,
  Plus,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { AllergyFormSheet } from "@/patient/components/allergies/AllergyFormSheet";
import { useAddAllergy, useAllergies, useDeleteAllergy } from "@/patient/hooks";
import type { AllergyRow } from "@/patient/types/patient";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  HERO_CHIP,
  HERO_DANGER_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  RailRow,
  SECONDARY_BTN,
  Segmented,
  StatTile,
  type Tone,
} from "@/patient/components/workspace";

const COMMON_PRESETS = [
  { substance: "Penicillin", severity: "critical" as const, reaction: "Anaphylaxis" },
  { substance: "Amoxicillin", severity: "severe" as const, reaction: "Hives & Swelling" },
  { substance: "Aspirin / NSAIDs", severity: "moderate" as const, reaction: "GI distress & Bronchospasm" },
  { substance: "Peanuts", severity: "critical" as const, reaction: "Anaphylaxis" },
  { substance: "Latex", severity: "moderate" as const, reaction: "Contact Dermatitis" },
  { substance: "Sulfa Antibiotics", severity: "severe" as const, reaction: "Severe Skin Rash" },
];

type Tab = "all" | "critical" | "moderate";

function severityStyle(severity?: string | null): { label: string; tone: Tone; icon: typeof Info } {
  switch (severity) {
    case "critical":
      return { label: "Critical", tone: "rose", icon: AlertCircle };
    case "severe":
      return { label: "Severe", tone: "rose", icon: AlertTriangle };
    case "moderate":
      return { label: "Moderate", tone: "amber", icon: AlertTriangle };
    default:
      return { label: "Mild", tone: "sky", icon: Info };
  }
}

export default function AllergiesPage() {
  const allergies = useAllergies();
  const add = useAddAllergy();
  const del = useDeleteAllergy();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rawList = useMemo(() => allergies.data?.allergies ?? [], [allergies.data]);

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

  const handleQuickAdd = async (preset: (typeof COMMON_PRESETS)[number]) => {
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
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<ShieldAlert size={13} aria-hidden />}
          kicker="Records & Labs"
          kickerMeta="Clinical safety registry"
          title={
            <>
              Allergies &amp; <HeroAccent>adverse reactions</HeroAccent>
            </>
          }
          description="Document confirmed drug, food, and environmental allergens to protect clinical decision-making and prevent contraindicated prescriptions."
          chips={
            <>
              {criticalCount > 0 ? (
                <span className={HERO_DANGER_CHIP}>
                  <AlertCircle size={12} aria-hidden />
                  {criticalCount} critical or severe
                </span>
              ) : (
                <span className={HERO_CHIP}>
                  <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                  No severe allergens on file
                </span>
              )}
              <span className={HERO_CHIP}>
                <QrCode size={12} className="text-sky-300" aria-hidden />
                Synced to emergency card
              </span>
            </>
          }
          actions={
            <>
              <Link href="/patient/ai" className={HERO_GHOST}>
                <Bot size={15} aria-hidden />
                Interaction AI
              </Link>
              <button type="button" onClick={() => setOpen(true)} className={HERO_PRIMARY}>
                <Plus size={15} className="text-sky-600" aria-hidden />
                Add allergy
              </button>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Allergens on file"
            icon={<ShieldAlert size={16} />}
            tone="bg-slate-100 text-slate-600"
            value={String(rawList.length)}
            sub="Drug, food & environmental"
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          />
          <StatTile
            label="Critical & severe"
            icon={<AlertCircle size={16} />}
            tone="bg-rose-50 text-rose-600"
            value={String(criticalCount)}
            sub={criticalCount ? "Shown to every prescriber" : "None recorded"}
            pulse={criticalCount > 0}
            badge={criticalCount > 0 ? { text: "Safety", tone: "bg-rose-50 text-rose-700" } : undefined}
            active={activeTab === "critical"}
            onClick={() => setActiveTab("critical")}
          />
          <StatTile
            label="Mild & moderate"
            icon={<AlertTriangle size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(moderateCount)}
            sub="Lower-risk reactions"
            active={activeTab === "moderate"}
            onClick={() => setActiveTab("moderate")}
          />
          <StatTile
            label="Emergency card"
            icon={<QrCode size={16} />}
            tone="bg-violet-50 text-violet-600"
            value="Synced"
            sub="Shared with first responders"
            href="/patient/emergency"
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="al-list">
          <PanelHeader
            id="al-list"
            icon={<ShieldAlert size={16} />}
            tone="bg-rose-50 text-rose-600"
            title="Known allergies"
            caption={
              allergies.isLoading
                ? "Loading…"
                : `${filteredAllergies.length} shown · ${criticalCount} high-risk`
            }
            action={
              <button type="button" onClick={() => setOpen(true)} className={SECONDARY_BTN}>
                <Plus size={13} aria-hidden />
                <span className="hidden sm:inline">Add allergy</span>
              </button>
            }
          />

          <div className="mt-5 flex flex-col gap-3">
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Search substance, reaction, or notes…"
              ariaLabel="Search allergies"
            />
            <Segmented<Tab>
              ariaLabel="Allergy filters"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: "all", label: "All", count: rawList.length },
                { value: "critical", label: "Critical & severe", count: criticalCount },
                { value: "moderate", label: "Mild & moderate", count: moderateCount },
              ]}
            />
          </div>

          {allergies.isLoading ? (
            <PanelSkeleton rows={4} />
          ) : filteredAllergies.length === 0 ? (
            <EmptyBlock
              icon={<ShieldCheck size={19} />}
              title={search ? "No allergies match your search" : "No known allergies recorded"}
              body={
                search
                  ? `No allergen found for “${search}”. Clear search to view the full list.`
                  : "No drug, food, or environmental sensitivities are flagged on your chart. Adding known reactions helps doctors avoid contraindicated prescriptions."
              }
              actions={
                search ? (
                  <button type="button" onClick={() => setSearch("")} className={SECONDARY_BTN}>
                    Clear search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <Plus size={13} aria-hidden />
                    Record an allergy
                  </button>
                )
              }
            />
          ) : (
            <div className="mt-5 space-y-2">
              {filteredAllergies.map((allergy: AllergyRow) => {
                const s = severityStyle(allergy.severity);
                const Icon = s.icon;
                const isDeleting = deletingId === allergy.id;
                return (
                  <RailRow
                    key={allergy.id}
                    tone={s.tone}
                    icon={<ShieldAlert size={17} />}
                    title={allergy.substance}
                    meta={allergy.reaction ? `Reaction · ${allergy.reaction}` : "No reaction recorded"}
                    trailing={
                      <>
                        <Badge tone={s.tone} className="capitalize">
                          <Icon size={11} aria-hidden />
                          {allergy.severity ?? "mild"}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => handleDelete(allergy.id)}
                          disabled={isDeleting}
                          title="Remove allergy"
                          aria-label={`Remove ${allergy.substance}`}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    }
                  >
                    {allergy.notes ? (
                      <span className="mt-0.5 block truncate text-[11px] text-slate-400">{allergy.notes}</span>
                    ) : null}
                  </RailRow>
                );
              })}
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Allergy tools">
          {!allergies.isLoading && rawList.length === 0 ? (
          <section className={PANEL} aria-labelledby="al-quick">
            <PanelHeader
              id="al-quick"
              icon={<Plus size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Quick add"
              caption="Common allergens — tap to record"
            />
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {COMMON_PRESETS.map((preset) => {
                const s = severityStyle(preset.severity);
                return (
                  <button
                    key={preset.substance}
                    type="button"
                    onClick={() => handleQuickAdd(preset)}
                    disabled={add.isPending}
                    className="group flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-left shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] transition-all hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(2,132,199,0.25)] disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-800 group-hover:text-rose-600">
                        {preset.substance}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">{preset.reaction}</span>
                    </span>
                    <Badge tone={s.tone}>
                      <Plus size={11} aria-hidden />
                      Add
                    </Badge>
                  </button>
                );
              })}
            </div>
          </section>
          ) : null}

          <QuickToolsPanel
            id="al-tools"
            tools={[
              { href: "/patient/emergency", label: "Emergency card", hint: "QR medical ID", icon: QrCode, tone: "from-rose-500 to-pink-600 shadow-rose-500/30" },
              { href: "/patient/ai", label: "Interaction AI", hint: "Check conflicts", icon: Bot, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { href: "/patient/records", label: "Records", hint: "Full file", icon: ShieldCheck, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/medications", label: "Medications", hint: "Active meds", icon: Info, tone: "from-teal-500 to-emerald-600 shadow-teal-500/30" },
            ]}
          />

          <PromoCard
            href="/patient/emergency"
            kicker="Emergency card"
            icon={<QrCode size={21} aria-hidden />}
            title="Critical allergies reach first responders"
            body="They are projected to your Emergency Medical ID automatically"
          />
        </aside>
      </div>

      <AllergyFormSheet
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </PatientPage>
  );
}
