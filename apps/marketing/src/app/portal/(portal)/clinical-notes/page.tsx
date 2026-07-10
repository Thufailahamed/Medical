"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit3, Search, Plus, CalendarDays, ChevronRight } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Card } from "@/portal/components/ui/Card";
import { Empty, ErrorState, Skeleton } from "@/portal/components/ui/Empty";
import { Drawer } from "@/portal/components/ui/Modal";
import { PageHeader } from "@/portal/components/ui/PageHeader";
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
      <PageHeader
        title={t("clinicalNotes.title")}
        subtitle={t("clinicalNotes.subtitle", { count: allNotes.length })}
        icon={<Edit3 size={18} className="text-violet-600" />}
        actions={
          <button
            type="button"
            className="portal-btn portal-btn-primary portal-btn-sm"
            onClick={() => setCreating(true)}
          >
            <Plus size={14} />
            {t("clinicalNotes.new")}
          </button>
        }
      />

      <Card padding={false} className="rounded-2xl border-border/50">
        <div className="portal-input-search-wrap px-3 py-2">
          <Search size={16} className="portal-input-icon-left text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("clinicalNotes.searchPlaceholder")}
            className="portal-input w-full text-sm"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs text-text-muted hover:text-text transition-colors shrink-0"
            >
              {t("common.clear")}
            </button>
          ) : null}
        </div>
      </Card>

      <Card padding={false} className="rounded-2xl border-border/50 overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("errors.generic")}
              description={(error as Error)?.message ?? t("errors.tryAgain")}
            />
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            title={search ? t("clinicalNotes.emptySearch") : t("clinicalNotes.empty")}
            description={search ? undefined : t("tab.notes.emptyBody")}
            icon={<Edit3 size={20} className="text-text-muted" />}
            action={
              search ? undefined : (
                <button
                  type="button"
                  className="portal-btn portal-btn-primary portal-btn-sm"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={14} />
                  {t("clinicalNotes.new")}
                </button>
              )
            }
            className="py-12"
          />
        ) : (
          <ul className="flex flex-col">
            {filtered.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => setSelected(note)}
                  className="group w-full flex items-center gap-3 p-4 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Edit3 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">
                      {note.title || t("clinicalNotes.untitled")}
                    </div>
                    <div className="text-xs text-text-soft truncate">
                      {note.patient?.name || t("clinicalNotes.unknownPatient")}
                      {note.diagnosis ? ` · ${note.diagnosis}` : ""}
                    </div>
                    {note.notes ? (
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">
                        {note.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-text-muted">
                      <CalendarDays size={11} />
                      <span className="text-[11px] font-medium tabular-nums">
                        {note.date ? formatDate(note.date) : formatDate(note.createdAt)}
                      </span>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-text-muted opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer
        open={creating}
        onClose={closeCreateDrawer}
        title={t("clinicalNotes.newTitle")}
        subtitle={pickedPatient?.name ?? t("clinicalNotes.newSubtitle")}
        size={pickedPatient ? "xl" : "md"}
      >
        {!pickedPatient ? (
          <Card className="portal-note-pick-card">
            <p className="portal-note-pick-hint">{t("clinicalNotes.pickPatientHint")}</p>
            <label className="portal-field-label">
              {t("clinicalNotes.fields.patient")}
            </label>
            <PatientCombobox value={null} onChange={(p) => p && setPickedPatient(p)} />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="portal-note-patient-bar">
              <Avatar name={pickedPatient.name} size="sm" />
              <div className="portal-note-patient-bar-body">
                <span className="portal-note-patient-bar-label">
                  {t("clinicalNotes.fields.patient")}
                </span>
                <span className="portal-note-patient-bar-name">{pickedPatient.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setPickedPatient(null)}
                className="portal-note-patient-change"
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
