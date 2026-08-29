"use client";

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
    "rounded-inner border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3 disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onEdit} className={btnCls}>
        Edit
      </button>
      {archived ? (
        <button
          type="button"
          onClick={onRestore}
          className={btnCls}
          disabled={restore.isPending}
        >
          Restore
        </button>
      ) : (
        <button
          type="button"
          onClick={onArchive}
          className={btnCls}
          disabled={archive.isPending}
        >
          Archive
        </button>
      )}
      <button
        type="button"
        onClick={onReturn}
        className={btnCls}
        disabled={move.isPending}
      >
        Return to me
      </button>
      <button
        type="button"
        onClick={onReextract}
        className={btnCls}
        disabled={!hasAttachments || reextract.isPending}
        title={!hasAttachments ? "Attach a file first" : "Re-run extraction on the first attached file"}
      >
        Re-extract
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={btnCls + " text-red-600"}
        disabled={del.isPending}
      >
        Delete
      </button>
    </div>
  );
}