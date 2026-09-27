"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Calendar,
  Edit2,
  FileEdit,
  FileText,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { NoteFormSheet } from "@/patient/components/notes/NoteFormSheet";
import {
  useAddNote,
  useDeleteNote,
  useEditNote,
  useNotes,
} from "@/patient/hooks";
import type { NoteRow } from "@/patient/types/patient";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";

const NOTE_TEMPLATES = [
  {
    title: "Questions for Doctor Visit",
    desc: "Symptoms, dosage queries, next tests",
    body: "1. Should I adjust my current medication dosage?\n2. Are these morning headaches related to blood pressure?\n3. When is my next diagnostic scan?",
  },
  {
    title: "Daily Vitals & Symptom Log",
    desc: "BP readings, heart rate, fatigue tracking",
    body: "Date: \nMorning BP: \nResting Heart Rate: \nSymptoms / Energy Level: ",
  },
  {
    title: "Medication Reaction Watch",
    desc: "Side effects, timings, duration notes",
    body: "Medicine name: \nObserved effect: \nTime after ingestion: \nSeverity & notes: ",
  },
];

export default function NotesPage() {
  const notes = useNotes();
  const add = useAddNote();
  const edit = useEditNote();
  const del = useDeleteNote();

  const [open, setOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteRow | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"all" | "pinned">("all");
  const [search, setSearch] = useState("");

  const rawNotes = notes.data?.notes ?? [];
  const pinnedCount = useMemo(
    () => rawNotes.filter((n) => n.pinned).length,
    [rawNotes],
  );

  const filteredNotes = useMemo(() => {
    let list = rawNotes;

    if (activeTab === "pinned") {
      list = list.filter((n) => n.pinned);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q),
      );
    }

    // Sort pinned to top, then by updated date
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [rawNotes, activeTab, search]);

  const handleEdit = (note: NoteRow) => {
    setEditingNote(note);
    setOpen(true);
  };

  const handleCreateNew = () => {
    setEditingNote(undefined);
    setOpen(true);
  };

  const handleApplyTemplate = (t: typeof NOTE_TEMPLATES[0]) => {
    setEditingNote({
      id: "",
      title: t.title,
      body: t.body,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this personal note?")) {
      del.mutate(id);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<FileEdit size={13} aria-hidden />}
        kicker="Personal Health Journal"
        title="Personal Notes & Observations"
        description="Private health journal to record daily symptom logs, questions for doctor appointments, and medication observations."
        status={
          pinnedCount > 0 ? (
            <HeroStatusPill label={`${pinnedCount} pinned`} tone="brand" />
          ) : (
            <HeroStatusPill label={`${rawNotes.length} notes`} tone="paper" />
          )
        }
        actions={
          <>
            <Link href="/patient/ai/chat" className={heroSecondaryAction}>
              <Bot size={13} aria-hidden />
              AI Clinical Assistant
            </Link>
            <button
              type="button"
              onClick={handleCreateNew}
              className={heroPrimaryAction}
            >
              <Plus size={14} aria-hidden />
              + New Health Note
            </button>
          </>
        }
        footer={
          <>
            <span>Total Notes · {rawNotes.length}</span>
            <span>Pinned Notes · {pinnedCount}</span>
            <span>Privacy Level · Patient Only</span>
            <span>Storage · Encrypted EHR</span>
          </>
        }
      />

      {/* ── 2. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-xl border border-border shadow-card">
        {/* Filter Tabs */}
        <SegmentedTabs
          ariaLabel="Note filters"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as "all" | "pinned")}
          tabs={[
            { id: "all", label: <>All Notes ({rawNotes.length})</> },
            {
              id: "pinned",
              label: (
                <>
                  <Pin size={12} aria-hidden />
                  <span>Pinned</span>
                  {pinnedCount > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                      {pinnedCount}
                    </span>
                  ) : null}
                </>
              ),
            },
          ]}
        />

        {/* Live Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes by keyword or title..."
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

      {/* ── 3. Notes Grid or Zero-State ─────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        {notes.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-xl bg-surface border border-border shadow-card flex flex-col items-center text-center gap-5">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-ink text-brand-soft shadow-2xs" aria-hidden>
              <FileEdit size={24} />
            </div>

            <div className="max-w-md">
              <h3 className="t-card-title text-text">
                {search ? "No notes match your search" : "No Personal Health Notes Yet"}
              </h3>
              <p className="text-xs sm:text-sm text-text-soft mt-1 leading-relaxed">
                {search
                  ? `No journal entries found matching "${search}". Clear search or create a new note.`
                  : "Keep track of questions for your doctor, log daily symptoms, or take notes during consultations. Only you can view these private memos."}
              </p>
            </div>

            {/* Quick Templates on Zero State */}
            {!search && (
              <div className="w-full max-w-xl flex flex-col gap-2.5 pt-3 border-t border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Start from a Template
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {NOTE_TEMPLATES.map((t) => (
                    <button
                      key={t.title}
                      type="button"
                      onClick={() => handleApplyTemplate(t)}
                      className="p-3 rounded-xl bg-surface-2 hover:bg-surface-2 border border-border hover:border-border-strong transition-all text-left flex flex-col justify-between gap-1 group cursor-pointer"
                    >
                      <span className="text-xs font-bold text-text group-hover:text-brand transition-colors">
                        {t.title}
                      </span>
                      <span className="text-[11px] text-text-muted line-clamp-1">
                        {t.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredNotes.map((note) => {
              return (
                <article
                  key={note.id}
                  className={cn(
                    "p-5 rounded-xl bg-surface border shadow-card hover:shadow-md transition-all flex flex-col justify-between gap-3 group",
                    note.pinned
                      ? "border-warn/50 bg-warn-soft/20"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {note.pinned ? (
                          <span className="p-1 rounded-md bg-warn-soft text-warn shrink-0 shadow-2xs">
                            <Pin size={12} className="fill-warn" />
                          </span>
                        ) : (
                          <span className="p-1 rounded-md bg-surface-2 text-text-muted shrink-0">
                            <FileText size={12} />
                          </span>
                        )}
                        <h3 className="t-card-title text-text truncate">
                          {note.title || "Untitled Health Note"}
                        </h3>
                      </div>

                      {/* Quick Action Icons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            edit.mutate({ id: note.id, pinned: !note.pinned })
                          }
                          disabled={edit.isPending}
                          title={note.pinned ? "Unpin note" : "Pin note"}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors cursor-pointer",
                            note.pinned
                              ? "text-warn hover:bg-warn-soft"
                              : "text-text-muted hover:text-text hover:bg-surface-2",
                          )}
                        >
                          <Pin size={14} className={note.pinned ? "fill-warn" : ""} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(note)}
                          title="Edit note"
                          className="p-1.5 rounded-lg text-text-muted hover:text-brand hover:bg-brand-soft transition-colors cursor-pointer"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(note.id)}
                          title="Delete note"
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Note Body with Clean Spacing */}
                    <p className="text-xs sm:text-sm text-text-soft font-medium whitespace-pre-wrap leading-relaxed line-clamp-6">
                      {note.body}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-border text-[11px] text-text-muted font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDate(note.updatedAt)}
                    </span>
                    <span className="text-[10.5px] uppercase font-bold text-text-muted">
                      Private Note
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Slide-Over Note Form Sheet ──────────────────────────────────── */}
      <NoteFormSheet
        open={open}
        onClose={() => setOpen(false)}
        initial={editingNote?.id ? editingNote : undefined}
        onSubmit={async (input) => {
          if (editingNote?.id) {
            await edit.mutateAsync({
              id: editingNote.id,
              ...input,
            });
          } else {
            await add.mutateAsync(input);
          }
        }}
      />
    </div>
  );
}
