"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Edit3, Search, Plus, CalendarDays, ChevronRight } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Input } from "@/portal/components/ui/Form";
import { Drawer } from "@/portal/components/ui/Modal";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { ClinicalNoteEditor } from "@/portal/components/notes/ClinicalNoteEditor";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";

interface ClinicalNote {
  id: string;
  patientId: string;
  title: string | null;
  diagnosis: string | null;
  notes: string | null;
  date: string | null;
  createdAt: string;
  patient: { id: string; name: string } | null;
}

export default function ClinicalNotesPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [pickedPatient, setPickedPatient] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "clinical-notes"],
    queryFn: () =>
      api<{ notes: ClinicalNote[]; count: number }>(
        "/doctor-portal/clinical-notes?limit=200"
      ),
  });

  function closeDrawer() {
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

      {/* Search */}
      <Card padding={false} className="rounded-2xl border-border/50">
        <div className="px-3 py-2 flex items-center gap-2">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("clinicalNotes.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              {t("common.clear")}
            </button>
          )}
        </div>
      </Card>

      {/* Notes List */}
      <Card padding={false} className="rounded-2xl border-border/50">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            title={search ? t("clinicalNotes.emptySearch") : t("clinicalNotes.empty")}
            className="py-12"
          />
        ) : (
          <ul className="flex flex-col">
            {filtered.map((note) => (
              <li
                key={note.id}
                className="group flex items-center gap-3 p-4 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors"
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
                  {note.notes && (
                    <p className="text-xs text-text-muted mt-1 line-clamp-2">
                      {note.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <CalendarDays size={11} className="text-text-muted" />
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
                      {(note.date || "").toUpperCase()}
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer
        open={creating}
        onClose={closeDrawer}
        title={t("clinicalNotes.newTitle")}
        subtitle={pickedPatient?.name ?? t("clinicalNotes.newSubtitle")}
        size="md"
      >
        {!pickedPatient ? (
          <div className="flex flex-col gap-3">
            <label className="text-[11px] text-text-soft">
              {t("clinicalNotes.fields.patient")}
            </label>
            <PatientCombobox value={null} onChange={(p) => p && setPickedPatient(p)} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-2/50">
              <span className="text-xs text-text-muted">
                {t("clinicalNotes.fields.patient")}
              </span>
              <span className="text-sm font-medium text-text truncate">
                {pickedPatient.name}
              </span>
              <button
                type="button"
                onClick={() => setPickedPatient(null)}
                className="text-xs text-brand hover:underline"
              >
                {t("common.change")}
              </button>
            </div>
            <ClinicalNoteEditor
              patientId={pickedPatient.id}
              onSaved={closeDrawer}
              onCancel={closeDrawer}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
