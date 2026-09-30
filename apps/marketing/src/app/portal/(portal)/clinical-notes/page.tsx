"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Edit3,
  Plus,
  ClipboardList,
  CalendarDays,
  ChevronRight,
  FileText,
  Stethoscope,
  ShieldCheck,
  Users,
  Activity,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Pill } from "@/portal/components/ui/Pill";
import { ErrorState } from "@/portal/components/ui/Empty";
import { Drawer } from "@/portal/components/ui/Modal";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  PRIMARY_BTN,
  ROW_LINK,
  RowAccent,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { ClinicalNoteEditor } from "@/portal/components/notes/ClinicalNoteEditor";
import { ClinicalNoteDetail } from "@/portal/components/notes/ClinicalNoteDetail";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import type { ClinicalNoteRecord } from "@/portal/lib/clinicalNote";

type Scope = "all" | "recent" | "diagnosed" | "open";

const RECENT_DAYS = 30;

function isRecent(n: ClinicalNoteRecord) {
  const d = new Date(n.date ?? n.createdAt).getTime();
  return !isNaN(d) && d >= Date.now() - RECENT_DAYS * 86_400_000;
}

export default function ClinicalNotesPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ClinicalNoteRecord | null>(null);
  const [pickedPatient, setPickedPatient] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["doctor-portal", "clinical-notes"],
    queryFn: () =>
      api<{ notes: ClinicalNoteRecord[]; count: number }>(
        "/doctor-portal/clinical-notes?limit=200",
      ),
  });

  function closeCreateDrawer() {
    setCreating(false);
    setPickedPatient(null);
  }

  const allNotes = data?.notes ?? [];

  // Status telemetry counters
  const totalCount = allNotes.length;
  const diagnosedCount = useMemo(
    () => allNotes.filter((n) => Boolean(n.diagnosis?.trim())).length,
    [allNotes]
  );
  const uniquePatientsCount = useMemo(
    () => new Set(allNotes.map((n) => n.patientId).filter(Boolean)).size,
    [allNotes]
  );
  const recentCount = useMemo(() => allNotes.filter(isRecent).length, [allNotes]);

  const filtered = allNotes.filter((note) => {
    if (scope === "recent" && !isRecent(note)) return false;
    if (scope === "diagnosed" && !note.diagnosis?.trim()) return false;
    if (scope === "open" && note.diagnosis?.trim()) return false;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    const haystack = [note.title, note.diagnosis, note.notes, note.patient?.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  const diagnosedPct = totalCount > 0 ? Math.round((diagnosedCount / totalCount) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Stethoscope size={13} aria-hidden />}
          kicker="Clinical documentation"
          kickerMeta={`${recentCount} in the last ${RECENT_DAYS} days`}
          title={
            <>
              Clinical notes &amp;{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                SOAP encounters
              </span>
            </>
          }
          description="Document consultations as structured Subjective, Objective, Assessment and Plan records, searchable across every chart."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                SNOMED CT coded
              </span>
              {totalCount - diagnosedCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setScope("open")}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
                >
                  <ClipboardList size={12} aria-hidden />
                  {totalCount - diagnosedCount} without an assessment
                </button>
              ) : null}
            </>
          }
          actions={
            <button type="button" onClick={() => setCreating(true)} className={HERO_PRIMARY}>
              <Plus size={15} strokeWidth={2.5} className="text-sky-600" aria-hidden />
              New clinical note
            </button>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Encounters"
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : String(totalCount)}
            sub="Documented notes"
            active={scope === "all"}
            onClick={() => setScope("all")}
          />
          <StatTile
            label="With diagnosis"
            icon={<Activity size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(diagnosedCount)}
            sub={`${diagnosedPct}% formally assessed`}
            progress={totalCount > 0 ? diagnosedPct : null}
            active={scope === "diagnosed"}
            onClick={() => setScope("diagnosed")}
          />
          <StatTile
            href="/portal/patients"
            label="Patients charted"
            icon={<Users size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(uniquePatientsCount)}
            sub="Unique clinical charts"
          />
          <StatTile
            label={`Last ${RECENT_DAYS} days`}
            icon={<CalendarDays size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(recentCount)}
            sub="Recent consultations"
            active={scope === "recent"}
            onClick={() => setScope("recent")}
          />
        </HeroOverlap>
      </div>

      {/* ── Notes ledger ───────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="notes-ledger">
        <PanelHeader
          id="notes-ledger"
          icon={<Edit3 size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Encounter notes"
          caption={
            isLoading
              ? "Loading notes…"
              : `${filtered.length} of ${totalCount} shown${search ? ` · matching “${search}”` : ""}`
          }
        />

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PanelSearch
            value={search}
            onChange={setSearch}
            placeholder="Search title, diagnosis, keywords or patient…"
            ariaLabel="Search clinical notes"
          />
          <Segmented<Scope>
            ariaLabel="Filter notes"
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: "All", count: totalCount },
              { value: "recent", label: `${RECENT_DAYS} days`, count: recentCount },
              { value: "diagnosed", label: "Diagnosed", count: diagnosedCount },
              { value: "open", label: "No assessment", count: totalCount - diagnosedCount },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[88px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="mt-5">
            <ErrorState
              title={t("errors.generic")}
              description={(error as Error)?.message ?? t("errors.tryAgain")}
            />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<Edit3 size={19} />}
            title={search ? "No matching notes" : "No clinical notes here yet"}
            body={
              search
                ? `Nothing matches “${search}”. Try a diagnosis, keyword or patient name.`
                : "SOAP notes you record during consultations appear here, newest first."
            }
            actions={
              search || scope !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setScope("all");
                  }}
                  className={SECONDARY_BTN}
                >
                  Clear filters
                </button>
              ) : (
                <button type="button" onClick={() => setCreating(true)} className={PRIMARY_BTN}>
                  <Plus size={13} strokeWidth={2.5} />
                  New clinical note
                </button>
              )
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {filtered.map((note) => {
              const when = note.date ?? note.createdAt;
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(note)}
                    className={cn(LIST_ROW, "w-full cursor-pointer text-left sm:items-start")}
                  >
                    <RowAccent className={note.diagnosis?.trim() ? "bg-emerald-500" : "bg-amber-400"} />
                    <div className="flex min-w-0 flex-1 items-start gap-3.5 pl-1.5">
                      {note.patient?.name ? (
                        <Avatar name={note.patient.name} size="md" className="mt-0.5 h-10 w-10 shrink-0" />
                      ) : (
                        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-sky-50 text-sky-600">
                          <Edit3 size={17} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                            {note.title || t("clinicalNotes.untitled")}
                          </span>
                          {note.diagnosis ? <Pill tone="info">{note.diagnosis}</Pill> : null}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                          {note.patient?.name ? (
                            <>
                              <span className="font-medium text-slate-600">{note.patient.name}</span>
                              <span className="text-slate-300">·</span>
                            </>
                          ) : null}
                          <CalendarDays size={11} />
                          <span className="tabular-nums">{formatDate(when)}</span>
                        </div>
                        {note.notes ? (
                          <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                            {note.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className={cn(ROW_LINK, "shrink-0 self-end sm:self-center")}>
                      Open
                      <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Create Clinical Note Drawer ────────────────────────────────── */}
      <Drawer
        open={creating}
        onClose={closeCreateDrawer}
        title={t("clinicalNotes.newTitle")}
        subtitle={pickedPatient?.name ?? t("clinicalNotes.newSubtitle")}
        size={pickedPatient ? "xl" : "md"}
      >
        {!pickedPatient ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500">{t("clinicalNotes.pickPatientHint")}</p>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("clinicalNotes.fields.patient")}
            </label>
            <PatientCombobox value={null} onChange={(p) => p && setPickedPatient(p)} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-sky-50/70 border border-sky-100">
              <div>
                <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">
                  {t("clinicalNotes.fields.patient")}
                </span>
                <span className="text-sm font-extrabold text-slate-900 truncate">
                  {pickedPatient.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPickedPatient(null)}
                className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
              >
                {t("common.change")}
              </button>
            </div>
            <ClinicalNoteEditor
              patientId={pickedPatient.id}
              onSaved={closeCreateDrawer}
              onCancel={closeCreateDrawer}
            />
          </div>
        )}
      </Drawer>

      {/* ── View Clinical Note Detail Drawer ───────────────────────────── */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || t("clinicalNotes.untitled")}
        subtitle={selected?.patient?.name ?? undefined}
        size="lg"
      >
        {selected ? <ClinicalNoteDetail note={selected} /> : null}
      </Drawer>
    </div>
  );
}
