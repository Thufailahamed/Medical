"use client";

import { useRef } from "react";

import {
  useAddAttachment,
  useDeleteAttachment,
  usePresignAttachment,
  useRecordAttachments,
} from "@/patient/hooks";
import { toast } from "@/portal/components/ui/Toast";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function RecordAttachmentsSection({ recordId }: { recordId: string }) {
  const query = useRecordAttachments(recordId);
  const add = useAddAttachment(recordId);
  const del = useDeleteAttachment();
  const presign = usePresignAttachment();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File too large", "Max 50 MB");
      e.target.value = "";
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast.error("Unsupported file type", `${file.type || "unknown"} not allowed`);
      e.target.value = "";
      return;
    }
    try {
      await add.mutateAsync({ file });
      toast.success("Attachment uploaded");
    } catch (err) {
      toast.error("Upload failed", err instanceof Error ? err.message : undefined);
    } finally {
      e.target.value = "";
    }
  }

  async function onDownload(fileId: string) {
    try {
      const { url } = await presign.mutateAsync({ fileId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("Could not download", err instanceof Error ? err.message : undefined);
    }
  }

  function onDelete(fileId: string) {
    if (!window.confirm("Delete this attachment?")) return;
    del
      .mutateAsync({ id: fileId, recordId })
      .then(() => toast.success("Attachment deleted"))
      .catch((e) =>
        toast.error("Delete failed", e instanceof Error ? e.message : undefined),
      );
  }

  const files = query.data?.files ?? [];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="t-section-title">Attachments</h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-inner border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3"
          disabled={add.isPending}
        >
          Add attachment
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED.join(",")}
          onChange={onPick}
          aria-label="Add attachment"
          className="hidden"
        />
      </header>

      {files.length === 0 ? (
        <p className="t-micro">No attachments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-inner bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.fileName}</p>
                <p className="t-micro">
                  {f.mimeType} · {humanSize(f.size)} ·{" "}
                  {new Date(f.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onDownload(f.id)}
                  className="rounded-inner border border-border bg-surface-1 px-2 py-1 text-xs hover:bg-surface-3"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(f.id)}
                  className="rounded-inner border border-border bg-surface-1 px-2 py-1 text-xs text-red-600 hover:bg-surface-3"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}