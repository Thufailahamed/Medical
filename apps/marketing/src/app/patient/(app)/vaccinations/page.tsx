"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Syringe,
  X,
} from "lucide-react";

import { VaccinationFormSheet } from "@/patient/components/vaccinations/VaccinationFormSheet";
import {
  useAddVaccination,
  useVaccinations,
  useVaccinationsDue,
} from "@/patient/hooks";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";

export default function VaccinationsPage() {
  const administered = useVaccinations();
  const due = useVaccinationsDue();
  const add = useAddVaccination();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "administered" | "due">("all");
  const [search, setSearch] = useState("");

  const administeredList = administered.data?.administered ?? [];
  const dueSlots = due.data?.due ?? [];
  const overdueSlots = due.data?.overdue ?? [];
  const upcomingSlots = due.data?.upcoming ?? [];
  const allDue = useMemo(
    () => [...overdueSlots, ...dueSlots, ...upcomingSlots],
    [overdueSlots, dueSlots, upcomingSlots],
  );

  const totalAdministered = administeredList.length;
  const totalDue = overdueSlots.length + dueSlots.length;
  const totalUpcoming = upcomingSlots.length;

  const filteredAdministered = useMemo(() => {
    if (activeTab === "due") return [];
    let list = administeredList;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.vaccineName.toLowerCase().includes(q) ||
          (v.provider || "").toLowerCase().includes(q) ||
          (v.notes || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [administeredList, activeTab, search]);

  const filteredDue = useMemo(() => {
    if (activeTab === "administered") return [];
    let list = allDue;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => v.vaccineName.toLowerCase().includes(q));
    }
    return list;
  }, [allDue, activeTab, search]);

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<Syringe size={13} aria-hidden />}
        kicker="WHO Immunisation Schedule"
        title="Vaccinations & Immunisation History"
        description="Log administered immunisations, track booster timelines, and monitor WHO/EPI schedule compliance."
        status={
          totalDue > 0 ? (
            <HeroStatusPill label={`${totalDue} due`} tone="warn" />
          ) : (
            <HeroStatusPill label="Up to date" tone="success" />
          )
        }
        actions={
          <>
            <Link href="/patient/ai/vaccination-card" className={heroSecondaryAction}>
              <Camera size={13} aria-hidden />
              Scan Card OCR
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={heroPrimaryAction}
            >
              <Plus size={14} aria-hidden />
              Record Vaccine
            </button>
          </>
        }
        footer={
          <>
            <span>Administered · {totalAdministered} Doses</span>
            <span>Due / Overdue · {totalDue} Pending</span>
            <span>Upcoming · {totalUpcoming} Scheduled</span>
            <span>Standard · EPI Compliant</span>
          </>
        }
      />

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-xl border border-border shadow-card">
        {/* Filter Tabs */}
        <SegmentedTabs
          ariaLabel="Vaccination filters"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as "all" | "administered" | "due")}
          tabs={[
            { id: "all", label: <>All ({totalAdministered + allDue.length})</> },
            { id: "administered", label: <>Administered ({totalAdministered})</> },
            {
              id: "due",
              label: (
                <>
                  <span>Due / Upcoming</span>
                  {totalDue > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                      {totalDue}
                    </span>
                  ) : null}
                </>
              ),
            },
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
            placeholder="Search vaccine, disease, or provider..."
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

      {/* ── 3. Vaccinations Content ────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        {/* Section: Administered Vaccinations */}
        {activeTab !== "due" && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="pt-kicker flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success" aria-hidden />
                <span>Administered Vaccinations</span>
                <span className="rounded-md bg-success-soft px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-success">
                  {filteredAdministered.length}
                </span>
              </h2>
            </div>

            {administered.isLoading ? (
              <div className="flex flex-col gap-2.5">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
                  />
                ))}
              </div>
            ) : filteredAdministered.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface border border-border shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-surface-2 text-text-muted shrink-0" aria-hidden>
                    <Syringe size={20} />
                  </div>
                  <div>
                    <h3 className="t-card-title text-text">
                      No Administered Vaccinations Recorded
                    </h3>
                    <p className="text-xs text-text-soft mt-0.5">
                      Log childhood immunisations, travel shots, or COVID-19 boosters for your personal medical record.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
                >
                  + Add First Vaccine
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredAdministered.map((v) => (
                  <article
                    key={v.id}
                    className="p-4 rounded-xl bg-surface border border-border shadow-card hover:shadow-md hover:border-border-strong transition-all flex items-start justify-between gap-3.5"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="grid h-10 w-10 place-items-center rounded-md bg-success-soft text-success shrink-0 mt-0.5" aria-hidden>
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-text text-sm truncate">
                          {v.vaccineName}
                        </h4>
                        {v.dose ? (
                          <span className="inline-block text-[11px] font-semibold text-success bg-success-soft px-2 py-0.5 rounded-md mt-1">
                            {v.dose}
                          </span>
                        ) : null}
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-soft font-medium">
                          <Calendar size={12} className="text-text-muted" />
                          <span>{formatDate(v.administeredAt)}</span>
                          {v.provider ? (
                            <>
                              <span>·</span>
                              <span className="truncate">{v.provider}</span>
                            </>
                          ) : null}
                        </div>
                        {v.notes ? (
                          <p className="text-[11px] text-text-muted mt-1 line-clamp-1">
                            {v.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-success-soft text-success shrink-0">
                      Administered
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Section: Due / Overdue Vaccinations */}
        {activeTab !== "administered" && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="pt-kicker flex items-center gap-2">
                <Clock size={16} className="text-warn" aria-hidden />
                <span>Due, Overdue &amp; Upcoming</span>
                <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-warn">
                  {filteredDue.length}
                </span>
              </h2>
            </div>

            {due.isLoading ? (
              <div className="flex flex-col gap-2.5">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
                  />
                ))}
              </div>
            ) : filteredDue.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface border border-border shadow-card flex items-center gap-3.5">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-success-soft text-success shrink-0" aria-hidden>
                  <Check size={18} />
                </div>
                <div>
                  <h3 className="t-card-title text-text">
                    No Vaccines Due or Overdue
                  </h3>
                  <p className="text-xs text-text-soft mt-0.5">
                    You are up to date on standard adult immunization and scheduled boosters.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredDue.map((slot) => {
                  const isOverdue = slot.status === "overdue";
                  const isUpcoming = slot.status === "upcoming";

                  return (
                    <article
                      key={slot.id}
                      className={cn(
                        "p-4 rounded-xl bg-surface border shadow-card transition-all flex items-start justify-between gap-3.5",
                        isOverdue
                          ? "border-danger/40 bg-danger-soft/20"
                          : isUpcoming
                          ? "border-border"
                          : "border-warn/40 bg-warn-soft/20",
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={cn(
                            "grid h-10 w-10 place-items-center rounded-md shrink-0 mt-0.5",
                            isOverdue
                              ? "bg-danger-soft text-danger"
                              : isUpcoming
                              ? "bg-brand-soft text-brand"
                              : "bg-warn-soft text-warn",
                          )}
                          aria-hidden
                        >
                          <Clock size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-text text-sm truncate">
                            {slot.vaccineName}
                          </h4>
                          {slot.doseNumber ? (
                            <span className="inline-block text-[11px] font-semibold text-text-soft bg-surface-2 px-2 py-0.5 rounded-md mt-1">
                              Dose #{slot.doseNumber}
                            </span>
                          ) : null}
                          <div className="flex items-center gap-2 mt-1 text-xs text-text-soft font-medium">
                            <Calendar size={12} className="text-text-muted" />
                            <span>Due: {formatDate(slot.dueAt)}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider shrink-0",
                          isOverdue
                            ? "bg-danger-soft text-danger"
                            : isUpcoming
                            ? "bg-surface-2 text-text-soft"
                            : "bg-warn-soft text-warn",
                        )}
                      >
                        {slot.status}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── 4. Smart Vaccination Card Scanner Callout ──────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-soft text-brand shrink-0" aria-hidden>
            <Camera size={22} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              Have a Physical Vaccination Card?
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              Take a photo of your immunization card or certificate. HealthHub AI will automatically extract doses and batch numbers.
            </p>
          </div>
        </div>

        <Link
          href="/patient/ai/vaccination-card"
          className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
        >
          <Sparkles size={13} aria-hidden />
          Launch AI Card Scanner
        </Link>
      </section>

      {/* ── 5. Record Form Sheet ───────────────────────────────────────────── */}
      <VaccinationFormSheet
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
