"use client";

// portal/components/admin/SlmcDocsPanel.tsx
//
// SLMC document review panel. Lists uploaded docs for a single
// doctor with thumbnail / file icon, lets the admin upload new
// docs, and approve / reject pending ones. The upload posts
// multipart/form-data via fetch; approve/reject use the regular
// JSON adminApi path. Approve is destructive-ish (flips
// slmcVerifiedAt) but the per-doc endpoint doesn't require step-up
// — only bulk deletes do.

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Modal } from "@/portal/components/ui/Modal";
import { Pill } from "@/portal/components/ui/Pill";
import { adminApi, adminDownload, adminQk } from "@/portal/lib/admin-api";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import { useAuthStore } from "@/portal/stores/auth";
import { toast } from "@/portal/components/ui/Toast";

type Doc = {
  id: string;
  doctorId: string;
  kind: "slmc_certificate" | "medical_license" | "other";
  fileName: string;
  mimeType: string;
  fileSize: number;
  decision: "pending" | "approved" | "rejected";
  decisionNote: string | null;
  decidedAt: string | null;
  uploadedById: string;
  uploadedByName: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<Doc["kind"], string> = {
  slmc_certificate: "SLMC certificate",
  medical_license: "Medical license",
  other: "Other",
};

/** Phrase used in the drop-zone prompt ("Drop an SLMC certificate…"). */
const KIND_NOUN: Record<Doc["kind"], string> = {
  slmc_certificate: "an SLMC certificate",
  medical_license: "a medical license",
  other: "a document",
};

const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function decisionTone(d: Doc["decision"]) {
  if (d === "approved") return "success" as const;
  if (d === "rejected") return "danger" as const;
  return "warn" as const;
}

export function SlmcDocsPanel({ doctorId }: { doctorId: string }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [kind, setKind] = useState<Doc["kind"]>("slmc_certificate");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Doc | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: adminQk.slmcDocs(doctorId),
    queryFn: () => adminApi<{ items: Doc[] }>(`/admin/doctors/${doctorId}/docs`),
  });

  const approve = useMutation({
    mutationFn: (docId: string) =>
      adminApi(`/admin/doctors/${doctorId}/docs/${docId}/approve`, {
        method: "POST",
        json: {},
      }),
    onSuccess: () => {
      toast.success("Document approved");
      qc.invalidateQueries({ queryKey: adminQk.slmcDocs(doctorId) });
      qc.invalidateQueries({ queryKey: ["admin", "doctors"] });
    },
    onError: (e: unknown) => toast.error("Approve failed", e instanceof Error ? e.message : undefined),
  });

  const reject = useMutation({
    mutationFn: ({ docId, note }: { docId: string; note: string }) =>
      adminApi(`/admin/doctors/${doctorId}/docs/${docId}/reject`, {
        method: "POST",
        json: { note },
      }),
    onSuccess: () => {
      toast.success("Document rejected");
      setRejectTarget(null);
      setRejectNote("");
      qc.invalidateQueries({ queryKey: adminQk.slmcDocs(doctorId) });
    },
    onError: (e: unknown) => toast.error("Reject failed", e instanceof Error ? e.message : undefined),
  });

  async function uploadFile(file: File) {
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Unsupported file type. Use PDF, PNG, JPEG, or WebP.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const token = useAuthStore.getState().token;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/admin/doctors/${doctorId}/docs`,
        {
          method: "POST",
          body: fd,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: adminQk.slmcDocs(doctorId) });
    } catch (e: unknown) {
      toast.error("Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // The API answers with a redirect to a short-lived signed URL, so fetch
  // with the admin bearer token and hand the browser a blob.
  async function download(d: Doc) {
    setDownloadingId(d.id);
    try {
      const { blob } = await adminDownload(`/admin/doctors/${doctorId}/docs/${d.id}/download`, d.fileName);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: unknown) {
      toast.error("Download failed", e instanceof Error ? e.message : undefined);
    } finally {
      setDownloadingId(null);
    }
  }

  const items = data?.items ?? [];
  const pending = items.filter((d) => d.decision === "pending").length;
  const approved = items.filter((d) => d.decision === "approved").length;
  const rejected = items.filter((d) => d.decision === "rejected").length;

  return (
    <div className="flex flex-col gap-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Pending", value: pending, tone: "bg-amber-50 text-amber-700", icon: <Clock3 size={14} /> },
          { label: "Approved", value: approved, tone: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 size={14} /> },
          { label: "Rejected", value: rejected, tone: "bg-red-50 text-red-600", icon: <XCircle size={14} /> },
        ].map((x) => (
          <div key={x.label} className="rounded-xl bg-slate-50 p-3">
            <span className={cn("inline-grid h-6 w-6 place-items-center rounded-md", x.tone)}>{x.icon}</span>
            <p className="mt-2 text-xl font-semibold leading-none tracking-[-0.02em] text-slate-900 tabular-nums">{isLoading ? "…" : x.value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{x.label}</p>
          </div>
        ))}
      </div>

      {/* Upload */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Upload a document</p>
          <div role="group" aria-label="Document type" className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-1">
            {(Object.keys(KIND_LABEL) as Doc["kind"][]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
                  kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
                )}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) uploadFile(f);
          }}
          disabled={uploading}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-7 text-center transition-all",
            dragOver ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-slate-50/60 hover:border-sky-300 hover:bg-sky-50/40",
            uploading && "cursor-wait opacity-70",
          )}
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-sky-600 shadow-[0_1px_2px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(15,23,42,0.07)]">
            {uploading ? <Loader2 size={19} className="animate-spin" /> : <UploadCloud size={19} />}
          </span>
          <span className="text-sm font-semibold text-slate-900">
            {uploading ? "Uploading…" : dragOver ? "Drop to upload" : `Drop ${KIND_NOUN[kind]} or click to browse`}
          </span>
          <span className="text-xs text-slate-400">PDF, PNG, JPEG or WebP</span>
        </button>
      </div>

      {/* Documents */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Documents on file</p>
          <span className="text-[11px] text-slate-400">{items.length} total</span>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-6 py-8 text-center">
            <FileText size={20} className="mx-auto text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">No documents uploaded yet</p>
            <p className="mt-0.5 text-xs text-slate-400">Upload the doctor&apos;s SLMC certificate to start verification.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((d) => {
              const isImage = d.mimeType.startsWith("image/");
              return (
                <li
                  key={d.id}
                  className="relative flex flex-col gap-3 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] sm:flex-row sm:items-center"
                >
                  <span
                    className={cn(
                      "absolute inset-y-3 left-0 w-[3px] rounded-r-full",
                      d.decision === "approved" ? "bg-emerald-500" : d.decision === "rejected" ? "bg-red-500" : "bg-amber-400",
                    )}
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                        isImage ? "bg-violet-50 text-violet-600" : "bg-red-50 text-red-600",
                      )}
                    >
                      {isImage ? <ImageIcon size={17} /> : <FileText size={17} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{d.fileName}</p>
                        <Pill tone={decisionTone(d.decision)}>{d.decision}</Pill>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {KIND_LABEL[d.kind]} · {formatBytes(d.fileSize)} · {d.uploadedByName ?? "Admin"} · {relativeTime(d.createdAt)}
                      </p>
                      {d.decisionNote ? (
                        <p className="mt-1 truncate rounded-md bg-slate-50 px-2 py-0.5 text-[11px] italic text-slate-500">
                          “{d.decisionNote}”{d.decidedByName ? ` — ${d.decidedByName}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => download(d)}
                      disabled={downloadingId === d.id}
                      title="Open document"
                      aria-label={`Open ${d.fileName}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                    >
                      {downloadingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    </button>
                    {d.decision === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => approve.mutate(d.id)}
                          disabled={approve.isPending}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={13} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectTarget(d);
                            setRejectNote("");
                          }}
                          disabled={reject.isPending}
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectNote("");
        }}
        title="Reject document"
        subtitle={rejectTarget?.fileName}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectTarget(null);
                setRejectNote("");
              }}
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={rejectNote.trim().length === 0 || reject.isPending}
              onClick={() => rejectTarget && reject.mutate({ docId: rejectTarget.id, note: rejectNote.trim() })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle size={13} />
              Reject document
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-500">The doctor will see this note in their verification history.</p>
        <textarea
          className="mt-3 h-24 w-full resize-none rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] outline-none placeholder:text-slate-400 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0284c7]"
          placeholder="e.g. Certificate is expired — please upload the 2026 renewal"
          value={rejectNote}
          maxLength={500}
          onChange={(e) => setRejectNote(e.target.value)}
          autoFocus
        />
        <p className="mt-1 text-right text-[11px] tabular-nums text-slate-400">{rejectNote.length}/500</p>
      </Modal>
    </div>
  );
}
