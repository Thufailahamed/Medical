"use client";

import { Archive, Pencil, RotateCcw, Sparkles, Trash2, UserRound } from "lucide-react";

import {
  useArchiveRecord,
  useDeleteRecord,
  useMoveRecord,
  useReExtractRecord,
  useRestoreRecord,
} from "@/patient/hooks";
import { toast } from "@/portal/components/ui/Toast";

export function RecordActionsBar({
  recordId,
  archived,
  hasAttachments,
  onEdit,
  onDeleteSuccess,
}: {
  recordId: string;
  archived: boolean;
  hasAttachments: boolean;
  onEdit: () => void;
  onDeleteSuccess: () => void;
}) {
  const archive = useArchiveRecord();
  const restore = useRestoreRecord();
  const move = useMoveRecord();
  const del = useDeleteRecord();
  const reextract = useReExtractRecord(recordId);

  async function onArchive() {
    try {
      await archive.mutateAsync(recordId);
      toast.success("Record archived");
    } catch (e) {
      toast.error("Could not archive", e instanceof Error ? e.message : undefined);
    }
  }

  async function onRestore() {
    try {
      await restore.mutateAsync(recordId);
      toast.success("Record restored");
    } catch (e) {
      toast.error("Could not restore", e instanceof Error ? e.message : undefined);
    }
  }

  async function onReturn() {
    try {
      await move.mutateAsync({ id: recordId, familyMemberId: null });
      toast.success("Returned to you");
    } catch (e) {
      toast.error("Could not move", e instanceof Error ? e.message : undefined);
    }
  }

  async function onReextract() {
    try {
      await reextract.mutateAsync();
      toast.success("Re-extraction queued");
    } catch (e) {
      toast.error("Could not re-extract", e instanceof Error ? e.message : undefined);
    }
  }

  function onDelete() {
    if (!window.confirm("Delete this record permanently? This cannot be undone.")) return;
    del
      .mutateAsync(recordId)
      .then(() => {
        toast.success("Record deleted");
        onDeleteSuccess();
      })
      .catch((e) => toast.error("Could not delete", e instanceof Error ? e.message : undefined));
  }

  const btnCls =
    "inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
      >
        <Pencil size={13} aria-hidden />
        Edit
      </button>
      {archived ? (
        <button type="button" onClick={onRestore} className={btnCls} disabled={restore.isPending}>
          <RotateCcw size={13} aria-hidden />
          Restore
        </button>
      ) : (
        <button type="button" onClick={onArchive} className={btnCls} disabled={archive.isPending}>
          <Archive size={13} aria-hidden />
          Archive
        </button>
      )}
      <button type="button" onClick={onReturn} className={btnCls} disabled={move.isPending}>
        <UserRound size={13} aria-hidden />
        Return to me
      </button>
      <button
        type="button"
        onClick={onReextract}
        className={btnCls}
        disabled={!hasAttachments || reextract.isPending}
        title={!hasAttachments ? "Attach a file first" : "Re-run extraction on the first attached file"}
      >
        <Sparkles size={13} aria-hidden />
        Re-extract
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-50 px-3.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
        disabled={del.isPending}
      >
        <Trash2 size={13} aria-hidden />
        Delete
      </button>
    </div>
  );
}
