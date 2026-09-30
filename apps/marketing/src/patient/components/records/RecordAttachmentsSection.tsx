"use client";

import { useRef } from "react";
import { Download, FileText, Image as ImageIcon, Paperclip, Upload } from "lucide-react";

import {
  useAddAttachment,
  useDeleteAttachment,
  usePresignAttachment,
  useRecordAttachments,
} from "@/patient/hooks";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";
import { EmptyBlock, PanelHeader, SECONDARY_BTN } from "@/portal/components/doctor/Workspace";

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
    <section className="flex flex-col" aria-labelledby="rec-attachments">
      <PanelHeader
        id="rec-attachments"
        icon={<Paperclip size={16} />}
        tone="bg-violet-50 text-violet-600"
        title="Attachments"
        caption={files.length ? `${files.length} file${files.length === 1 ? "" : "s"} · PDF or image, up to 50 MB` : "PDF or image, up to 50 MB"}
        action={
          <>
            <button type="button" onClick={() => fileRef.current?.click()} className={SECONDARY_BTN} disabled={add.isPending}>
              <Upload size={13} aria-hidden />
              {add.isPending ? "Uploading…" : "Add attachment"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED.join(",")}
              onChange={onPick}
              aria-label="Add attachment"
              className="hidden"
            />
          </>
        }
      />

      {files.length === 0 ? (
        <EmptyBlock
          icon={<Paperclip size={19} />}
          title="No attachments yet"
          body="Upload the original report or scan so it travels with this record."
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {files.map((f) => {
            const isPdf = f.mimeType === "application/pdf";
            return (
              <li
                key={f.id}
                className="group relative flex items-center gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
              >
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                    isPdf ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-600",
                  )}
                  aria-hidden
                >
                  {isPdf ? <FileText size={16} /> : <ImageIcon size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{f.fileName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {isPdf ? "PDF" : (f.mimeType.split("/")[1] ?? f.mimeType).toUpperCase()} · {humanSize(f.size)} ·{" "}
                    {new Date(f.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" onClick={() => onDownload(f.id)} className={SECONDARY_BTN + " h-8 px-2.5"}>
                    <Download size={13} aria-hidden />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(f.id)}
                    className="inline-flex h-8 items-center rounded-lg bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
