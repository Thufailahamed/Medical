"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Edit3,
  Search,
  Plus,
  CalendarDays,
  ChevronRight,
  X,
  FileText,
  Stethoscope,
  ShieldCheck,
  Users,
  Activity,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Pill } from "@/portal/components/ui/Pill";
import { ErrorState, Skeleton } from "@/portal/components/ui/Empty";
import { Drawer } from "@/portal/components/ui/Modal";
import { ChartEmpty } from "@/portal/components/chart/ChartEmpty";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { ClinicalNoteEditor } from "@/portal/components/notes/ClinicalNoteEditor";
import { ClinicalNoteDetail } from "@/portal/components/notes/ClinicalNoteDetail";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import type { ClinicalNoteRecord } from "@/portal/lib/clinicalNote";

export default function ClinicalNotesPage() {
  const t = useT();
  const [search, setSearch] = useState("");
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
  const recentCount = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return allNotes.filter((n) => {
      const d = n.date ? new Date(n.date).getTime() : new Date(n.createdAt).getTime();
      return !isNaN(d) && d >= thirtyDaysAgo;
    }).length;
  }, [allNotes]);

  const filtered = allNotes.filter((note) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    const haystack = [note.title, note.diagnosis, note.notes, note.patient?.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="flex flex-col gap-5">
      {/* ── Oceanic Hero Header ────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden flex flex-col gap-6"
        style={{
          background:
            "radial-gradient(134.49% 134.49% at 94.63% 0%, #0369A1 0%, #075985 42.6%, #0C4A6E 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/20">
                EHR Clinical Documentation
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-300/20 text-sky-100 border border-sky-300/30 flex items-center gap-1">
                <ShieldCheck size={13} />
                <span>HIPAA & SNOMED CT Compliant</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
              Clinical Notes & SOAP Encounters
            </h1>
            <p className="text-sm text-sky-100/90 max-w-2xl mt-1 leading-relaxed">
              Document and manage patient consultations with structured Subjective, Objective, Assessment, and Plan (SOAP) clinical encounter records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-sky-950 bg-white shadow-md hover:bg-sky-50 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Record New Clinical Note</span>
          </button>
        </div>

        {/* 4 Telemetry Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Total Encounters</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{totalCount}</span>
            <span className="text-[10.5px] text-sky-200/80 mt-0.5">Documented clinical notes</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Diagnosed Cases</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{diagnosedCount}</span>
            <span className="text-[10.5px] text-emerald-200/80 mt-0.5">With formal assessment</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Patients Treated</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{uniquePatientsCount}</span>
            <span className="text-[10.5px] text-amber-200/80 mt-0.5">Unique clinical charts</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-teal-200 uppercase tracking-wider">Last 30 Days</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{recentCount}</span>
            <span className="text-[10.5px] text-teal-200/80 mt-0.5">Recent consultations</span>
          </div>
        </div>
      </div>

      {/* ── Search Canvas ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all">
        <Search size={16} className="text-slate-400 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by note title, diagnosis, clinical keywords, or patient name…"
          className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="h-5 w-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Clinical Notes Listing ────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-5 flex flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="p-5">
            <ErrorState
              title={t("errors.generic")}
              description={(error as Error)?.message ?? t("errors.tryAgain")}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <ChartEmpty
              icon={<Edit3 size={24} />}
              title="No clinical notes found"
              description={
                search
                  ? `No clinical notes matching "${search}". Try clearing your search query.`
                  : "No clinical encounter notes have been recorded in this clinic yet."
              }
              action={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer"
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    }}
                  >
                    <Plus size={14} className="inline mr-1" />
                    Record New Clinical Note
                  </button>
                )
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {filtered.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => setSelected(note)}
                  className="group w-full flex items-start gap-4 p-5 hover:bg-sky-50/40 transition-colors text-left cursor-pointer"
                >
                  <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Edit3 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                        {note.title || t("clinicalNotes.untitled")}
                      </span>
                      {note.patient?.name && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {note.patient.name}
                        </span>
                      )}
                      {note.diagnosis && (
                        <Pill tone="info">
                          {note.diagnosis}
                        </Pill>
                      )}
                    </div>
                    {note.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 line-clamp-2 leading-relaxed font-medium mt-1.5">
                        {note.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 mt-1">
                    <div className="flex items-center gap-1 text-slate-400">
                      <CalendarDays size={13} />
                      <span className="text-xs font-medium tabular-nums text-slate-500">
                        {note.date ? formatDate(note.date) : formatDate(note.createdAt)}
                      </span>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 group-hover:bg-sky-50 group-hover:text-sky-700 group-hover:border-sky-200 border border-slate-200 transition-all flex items-center gap-1">
                      <span>View Note</span>
                      <ChevronRight size={13} />
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
