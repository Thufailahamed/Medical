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
            All Notes ({rawNotes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pinned")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "pinned"
                ? "bg-white text-sky-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Pin size={12} />
            <span>Pinned</span>
            {pinnedCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                {pinnedCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes by keyword or title..."
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

      {/* ── 3. Notes Grid or Zero-State ─────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        {notes.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center text-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-2xs">
              <FileEdit size={28} />
            </div>

            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">
                {search ? "No notes match your search" : "No Personal Health Notes Yet"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                {search
                  ? `No journal entries found matching "${search}". Clear search or create a new note.`
                  : "Keep track of questions for your doctor, log daily symptoms, or take notes during consultations. Only you can view these private memos."}
              </p>
            </div>

            {/* Quick Templates on Zero State */}
            {!search && (
              <div className="w-full max-w-xl flex flex-col gap-2.5 pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Start from a Template
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {NOTE_TEMPLATES.map((t) => (
                    <button
                      key={t.title}
                      type="button"
                      onClick={() => handleApplyTemplate(t)}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200/80 hover:border-sky-300 transition-all text-left flex flex-col justify-between gap-1 group cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-900 group-hover:text-sky-800 transition-colors">
                        {t.title}
                      </span>
                      <span className="text-[11px] text-slate-400 line-clamp-1">
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
                    "p-5 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group",
                    note.pinned
                      ? "border-amber-300/80 bg-amber-50/15 ring-1 ring-amber-400/20"
                      : "border-slate-200/90 hover:border-sky-300",
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {note.pinned ? (
                          <span className="p-1 rounded-md bg-amber-100 text-amber-800 shrink-0 shadow-2xs">
                            <Pin size={12} className="fill-amber-700" />
                          </span>
                        ) : (
                          <span className="p-1 rounded-md bg-slate-100 text-slate-500 shrink-0">
                            <FileText size={12} />
                          </span>
                        )}
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
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
                              ? "text-amber-700 hover:bg-amber-100"
                              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                          )}
                        >
                          <Pin size={14} className={note.pinned ? "fill-amber-600" : ""} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(note)}
                          title="Edit note"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(note.id)}
                          title="Delete note"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Note Body with Clean Spacing */}
                    <p className="text-xs sm:text-sm text-slate-600 font-medium whitespace-pre-wrap leading-relaxed line-clamp-6">
                      {note.body}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDate(note.updatedAt)}
                    </span>
                    <span className="text-[10.5px] uppercase font-bold text-slate-400">
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
