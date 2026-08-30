"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Plus, Search } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { ClinicalNoteEditor } from "@/portal/components/notes/ClinicalNoteEditor";
import { ClinicalNoteDetail } from "@/portal/components/notes/ClinicalNoteDetail";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";
import type { ClinicalNoteRecord } from "@/portal/lib/clinicalNote";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
} from "@/portal/components/chart";

interface NotesResponse {
  notes: ClinicalNoteRecord[];
  count: number;
}

export default function ClinicalNotesTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ClinicalNoteRecord | null>(null);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "clinical-notes", id, q],
    queryFn: () =>
      api<NotesResponse>(
        `/doctor-portal/clinical-notes?patientId=${id}&q=${encodeURIComponent(q)}&limit=100`,
      ),
  });

  const rows = data?.notes ?? [];

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<Stethoscope size={18} />}
        title={t("tab.notes.title")}
        subtitle={t("tab.notes.subtitle", { count: rows.length })}
        badge={{ count: rows.length, tone: "brand" }}
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            <Plus size={14} />
            <span>{t("tab.notes.new")}</span>
          </button>
        }
      />

      <ChartList
        items={rows}
        isLoading={isLoading}
        isEmpty={!isLoading && rows.length === 0}
        toolbar={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs max-w-xs flex-1">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("tab.notes.searchPlaceholder")}
              className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 outline-none"
            />
          </div>
        }
        emptyState={
          <ChartEmpty
            icon={<Stethoscope size={22} />}
            title={t("tab.notes.empty")}
            description={t("tab.notes.emptyBody")}
            action={
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                <Plus size={14} />
                <span>{t("tab.notes.new")}</span>
              </button>
            }
          />
        }
        renderRow={(n) => (
          <ChartRow
            icon={<Stethoscope size={16} />}
            iconTone="brand"
            title={n.title || t("clinicalNotes.untitled")}
            subtitle={
              n.diagnosis
                ? `${t("clinicalNotes.detail.diagnosis")}: ${n.diagnosis}`
                : n.notes
                  ? n.notes.slice(0, 120) + (n.notes.length > 120 ? "…" : "")
                  : undefined
            }
            meta={
              n.createdAt ? (
                <span className="text-[11px] text-text-muted">
                  {formatDateTime(n.createdAt)}
                </span>
              ) : null
            }
            onClick={() => setSelected(n)}
          />
        )}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("tab.notes.new")}
        size="xl"
      >
        <ClinicalNoteEditor
          patientId={id}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Drawer>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || t("clinicalNotes.untitled")}
        size="lg"
      >
        {selected ? <ClinicalNoteDetail note={selected} /> : null}
      </Drawer>
    </div>
  );
}
