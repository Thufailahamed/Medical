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
                <Syringe size={12} className="text-sky-300" />
                WHO Immunisation Schedule
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Vaccinations &amp; Immunisation History
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Log administered immunisations, track booster timelines, and monitor WHO/EPI schedule compliance.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/ai/vaccination-card"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Camera size={13} />
                <span>Scan Card OCR</span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <Plus size={14} className="text-sky-700" />
                <span>Record Vaccine</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <button
              type="button"
              onClick={() => setActiveTab("administered")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "administered"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-emerald-200 truncate">
                  Administered
                </p>
                <p className="text-base font-extrabold text-white">
                  {totalAdministered} Doses
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("due")}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border cursor-pointer",
                activeTab === "due"
                  ? "bg-white/20 border-white/30 shadow-xs"
                  : "bg-white/10 border-white/10 hover:bg-white/15",
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Due / Overdue
                </p>
                <p className="text-base font-extrabold text-white">
                  {totalDue} Pending
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Calendar size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Upcoming
                </p>
                <p className="text-base font-extrabold text-white">
                  {totalUpcoming} Scheduled
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Standard
                </p>
                <p className="text-base font-extrabold text-white">EPI Compliant</p>
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
            All ({totalAdministered + allDue.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("administered")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeTab === "administered"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Administered ({totalAdministered})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("due")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "due"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <span>Due / Upcoming</span>
            {totalDue > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                {totalDue}
              </span>
            ) : null}
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
            placeholder="Search vaccine, disease, or provider..."
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

      {/* ── 3. Vaccinations Content ────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        {/* Section: Administered Vaccinations */}
        {activeTab !== "due" && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Administered Vaccinations</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  {filteredAdministered.length}
                </span>
              </h2>
            </div>

            {administered.isLoading ? (
              <div className="flex flex-col gap-2.5">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
                  />
                ))}
              </div>
            ) : filteredAdministered.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <Syringe size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      No Administered Vaccinations Recorded
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Log childhood immunisations, travel shots, or COVID-19 boosters for your personal medical record.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-colors shrink-0 cursor-pointer"
                >
                  + Add First Vaccine
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredAdministered.map((v) => (
                  <article
                    key={v.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex items-start justify-between gap-3.5"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-100">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate">
                          {v.vaccineName}
                        </h4>
                        {v.dose ? (
                          <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 border border-emerald-100">
                            {v.dose}
                          </span>
                        ) : null}
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{formatDate(v.administeredAt)}</span>
                          {v.provider ? (
                            <>
                              <span>·</span>
                              <span className="truncate">{v.provider}</span>
                            </>
                          ) : null}
                        </div>
                        {v.notes ? (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            {v.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
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
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-amber-600" />
                <span>Due, Overdue &amp; Upcoming</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                  {filteredDue.length}
                </span>
              </h2>
            </div>

            {due.isLoading ? (
              <div className="flex flex-col gap-2.5">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
                  />
                ))}
              </div>
            ) : filteredDue.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    No Vaccines Due or Overdue
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
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
                        "p-4 rounded-2xl bg-white border shadow-xs transition-all flex items-start justify-between gap-3.5",
                        isOverdue
                          ? "border-rose-200 bg-rose-50/20"
                          : isUpcoming
                          ? "border-slate-200/90"
                          : "border-amber-200 bg-amber-50/20",
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border",
                            isOverdue
                              ? "bg-rose-50 text-rose-600 border-rose-100"
                              : isUpcoming
                              ? "bg-sky-50 text-sky-600 border-sky-100"
                              : "bg-amber-50 text-amber-600 border-amber-100",
                          )}
                        >
                          <Clock size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate">
                            {slot.vaccineName}
                          </h4>
                          {slot.doseNumber ? (
                            <span className="inline-block text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md mt-1">
                              Dose #{slot.doseNumber}
                            </span>
                          ) : null}
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                            <Calendar size={12} className="text-slate-400" />
                            <span>Due: {formatDate(slot.dueAt)}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize border shrink-0",
                          isOverdue
                            ? "bg-rose-100 text-rose-800 border-rose-200"
                            : isUpcoming
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-amber-100 text-amber-800 border-amber-200",
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
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
            <Camera size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Have a Physical Vaccination Card?
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Take a photo of your immunization card or certificate. HealthHub AI will automatically extract doses and batch numbers.
            </p>
          </div>
        </div>

        <Link
          href="/patient/ai/vaccination-card"
          className="px-4 py-2 rounded-xl text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Sparkles size={13} className="text-sky-600" />
          <span>Launch AI Card Scanner</span>
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
