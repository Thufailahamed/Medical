"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Edit3, Search, CalendarDays, ChevronRight } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Input } from "@/portal/components/ui/Form";
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

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "clinical-notes"],
    queryFn: () =>
      api<{ notes: ClinicalNote[]; count: number }>(
        "/doctor-portal/clinical-notes?limit=200"
      ),
  });

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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">
          {t("clinicalNotes.title")}
        </h1>
        <p className="text-sm text-text-soft mt-1">
          {t("clinicalNotes.subtitle", { count: allNotes.length })}
        </p>
      </div>

      {/* Search */}
      <Card padding={false}>
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
              className="text-xs text-text-muted hover:text-text"
            >
              {t("common.clear")}
            </button>
          )}
        </div>
      </Card>

      {/* Notes List */}
      <Card padding={false}>
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
                className="flex items-center gap-3 p-4 border-b border-border last:border-0 hover:bg-surface-2/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
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
                    <span className="text-[10px] text-text-muted font-medium">
                      {(note.date || "").toUpperCase()}
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-text-muted" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
