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
  Sparkles,
  Trash2,
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
import {
  EmptyBlock,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

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

  const rawNotes = useMemo(() => notes.data?.notes ?? [], [notes.data?.notes]);
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

  const handleApplyTemplate = (t: (typeof NOTE_TEMPLATES)[number]) => {
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
    <PatientPage>
      <PatientHero
        kickerIcon={<FileEdit size={13} aria-hidden />}
        kicker="Personal journal"
        kickerMeta="Private to you"
        title={
          <>
            Personal notes <HeroAccent>&amp; observations</HeroAccent>
          </>
        }
        description="Private health journal to record daily symptom logs, questions for doctor appointments, and medication observations."
        chips={
          <>
            <span className={HERO_CHIP}>
              <FileText size={12} className="text-sky-300" />
              {rawNotes.length} notes
            </span>
            {pinnedCount > 0 ? (
              <span className={HERO_CHIP}>
                <Pin size={12} className="text-amber-300" />
                {pinnedCount} pinned
              </span>
            ) : null}
            <span className={HERO_CHIP}>Encrypted · patient only</span>
          </>
        }
        actions={
          <>
            <Link href="/patient/ai/chat" className={HERO_GHOST}>
              <Bot size={13} /> AI assistant
            </Link>
            <button type="button" onClick={handleCreateNew} className={HERO_PRIMARY}>
              <Plus size={14} className="text-sky-600" /> New note
            </button>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<FileText size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="All notes"
          value={String(rawNotes.length)}
          sub="Journal entries"
          active={activeTab === "all"}
          onClick={() => setActiveTab("all")}
        />
        <StatTile
          icon={<Pin size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Pinned"
          value={String(pinnedCount)}
          sub="Kept on top"
          active={activeTab === "pinned"}
          onClick={() => setActiveTab("pinned")}
        />
        <StatTile
          icon={<Sparkles size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Templates"
          value={String(NOTE_TEMPLATES.length)}
          sub="Quick starts"
        />
        <StatTile
          icon={<Bot size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="AI assistant"
          value="24/7"
          sub="Summarize notes"
          href="/patient/ai/chat"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<FileEdit size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Journal"
              caption={`${filteredNotes.length} of ${rawNotes.length} notes`}
              action={
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white transition hover:bg-sky-500"
                >
                  <Plus size={13} /> New
                </button>
              }
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Segmented
                ariaLabel="Note filters"
                options={[
                  { value: "all", label: `All Notes (${rawNotes.length})` },
                  {
                    value: "pinned",
                    label: `Pinned (${pinnedCount})`,
                    icon: <Pin size={12} aria-hidden />,
                  },
                ]}
                value={activeTab}
                onChange={(v) => setActiveTab(v as "all" | "pinned")}
              />
              <PanelSearch
                value={search}
                onChange={setSearch}
                placeholder="Search notes by keyword or title…"
                className="flex-1 sm:max-w-xs"
              />
            </div>

            {notes.isLoading ? (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="mt-4">
                <EmptyBlock
                  icon={<FileEdit size={19} />}
                  title={search ? "No notes match your search" : "No personal health notes yet"}
                  body={
                    search
                      ? `No journal entries found matching "${search}". Clear search or create a new note.`
                      : "Track questions for your doctor, log daily symptoms, or take notes during consultations. Only you can view these."
                  }
                  actions={
                    !search ? (
                      <button
                        type="button"
                        onClick={handleCreateNew}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500"
                      >
                        <Plus size={14} /> Create note
                      </button>
                    ) : undefined
                  }
                />
                {!search ? (
                  <div className="mt-2 border-t border-slate-100 pt-5">
                    <p className={GROUP_LABEL}>Start from a template</p>
                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {NOTE_TEMPLATES.map((t) => (
                        <button
                          key={t.title}
                          type="button"
                          onClick={() => handleApplyTemplate(t)}
                          className="group flex flex-col justify-between gap-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-left transition-all hover:border-sky-200 hover:bg-sky-50/60"
                        >
                          <span className="text-xs font-bold text-slate-900 transition-colors group-hover:text-sky-700">
                            {t.title}
                          </span>
                          <span className="line-clamp-1 text-[11px] text-slate-400">
                            {t.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredNotes.map((note) => (
                  <article
                    key={note.id}
                    className={cn(
                      "group flex flex-col justify-between gap-3 rounded-2xl border bg-white p-5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)] transition-all hover:shadow-md",
                      note.pinned
                        ? "border-amber-200 bg-amber-50/40"
                        : "border-slate-100 hover:border-slate-200",
                    )}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {note.pinned ? (
                            <span className="shrink-0 rounded-md bg-amber-100 p-1 text-amber-600">
                              <Pin size={12} className="fill-amber-500" />
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-md bg-slate-100 p-1 text-slate-400">
                              <FileText size={12} />
                            </span>
                          )}
                          <h3 className="truncate text-sm font-bold text-slate-900">
                            {note.title || "Untitled Health Note"}
                          </h3>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              edit.mutate({ id: note.id, pinned: !note.pinned })
                            }
                            disabled={edit.isPending}
                            title={note.pinned ? "Unpin note" : "Pin note"}
                            className={cn(
                              "rounded-lg p-1.5 transition-colors",
                              note.pinned
                                ? "text-amber-600 hover:bg-amber-100"
                                : "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
                            )}
                          >
                            <Pin size={14} className={note.pinned ? "fill-amber-500" : ""} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(note)}
                            title="Edit note"
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-700"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            title="Delete note"
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <p className="line-clamp-6 whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600 sm:text-sm">
                        {note.body}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-medium text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {formatDate(note.updatedAt)}
                      </span>
                      <span className="text-[10.5px] font-bold uppercase text-slate-400">
                        Private note
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<Sparkles size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Templates"
              caption="One-tap structured notes."
            />
            <div className="mt-4 flex flex-col gap-2">
              {NOTE_TEMPLATES.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => handleApplyTemplate(t)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-left transition-all hover:border-sky-200 hover:bg-sky-50/60"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-slate-900 group-hover:text-sky-700">
                      {t.title}
                    </div>
                    <div className="truncate text-[11px] text-slate-400">{t.desc}</div>
                  </div>
                  <Plus size={14} className="shrink-0 text-slate-300 transition-colors group-hover:text-sky-600" />
                </button>
              ))}
            </div>
          </section>

          <PromoCard
            icon={<Bot size={21} aria-hidden />}
            kicker="Smarter notes"
            title="Summarize with AI"
            body="Turn scattered symptom logs into a clean summary you can share at your next visit."
            href="/patient/ai/chat"
          />

          <QuickToolsPanel
            id="notes-tools"
            title="Tools"
            tools={[
              {
                icon: FileText,
                label: "Records",
                hint: "Documents",
                href: "/patient/records",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: Calendar,
                label: "Appointments",
                hint: "Schedule",
                href: "/patient/appointments",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
              {
                icon: Bot,
                label: "AI chat",
                hint: "24/7 answers",
                href: "/patient/ai/chat",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
            ]}
          />
        </aside>
      </div>

      {/* ── Slide-over note form (unchanged) ─────────────────────────────── */}
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
    </PatientPage>
  );
}
