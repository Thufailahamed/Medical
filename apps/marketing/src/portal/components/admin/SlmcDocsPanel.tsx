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
  Download,
  FileText,
  Image as ImageIcon,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
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
    onError: (e: any) => toast.error("Approve failed", e?.message),
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
    onError: (e: any) => toast.error("Reject failed", e?.message),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Unsupported file type. Use PDF, PNG, JPEG, or WebP.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "slmc_certificate");
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
    } catch (e: any) {
      toast.error("Upload failed", e?.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (isLoading) return <p className="text-sm text-text-soft">Loading documents…</p>;

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Verification documents</p>
          <p className="text-xs text-text-muted">
            Uploaded by admin · {items.length} on file
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME.join(",")}
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={14} className="mr-1" />
            {uploading ? "Uploading…" : "Upload cert"}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-text-soft">No documents uploaded yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3"
            >
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-surface-2 rounded-lg">
                {d.mimeType.startsWith("image/") ? (
                  <ImageIcon size={18} className="text-text-soft" />
                ) : (
                  <FileText size={18} className="text-text-soft" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{d.fileName}</p>
                <p className="text-[11px] text-text-muted">
                  {KIND_LABEL[d.kind]} · {formatBytes(d.fileSize)} ·
                  uploaded by {d.uploadedByName ?? "—"}
                </p>
                {d.decisionNote ? (
                  <p className="text-[11px] text-text-soft mt-0.5 italic">
                    Note: {d.decisionNote}
                  </p>
                ) : null}
              </div>
              <Pill tone={decisionTone(d.decision)}>{d.decision}</Pill>
              <a
                href={`/admin/doctors/${doctorId}/docs/${d.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="text-text-soft hover:text-text"
                title="Download"
              >
                <Download size={16} />
              </a>
              {d.decision === "pending" ? (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => approve.mutate(d.id)}
                    disabled={approve.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={14} className="mr-1" />Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRejectTarget(d);
                      setRejectNote("");
                    }}
                    disabled={reject.isPending}
                  >
                    <XCircle size={14} className="mr-1" />Reject
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface border border-border rounded-2xl p-5 w-[420px] max-w-[92vw]">
            <p className="text-base font-semibold">Reject {rejectTarget.fileName}?</p>
            <p className="text-xs text-text-muted mt-1">
              The doctor will see this note in their rejection history.
            </p>
            <textarea
              className="w-full mt-3 p-2 text-sm border border-border rounded-lg bg-surface-2"
              rows={3}
              placeholder="Reason (required, max 500 chars)"
              value={rejectNote}
              maxLength={500}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectNote("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                disabled={rejectNote.trim().length === 0 || reject.isPending}
                onClick={() =>
                  reject.mutate({ docId: rejectTarget.id, note: rejectNote.trim() })
                }
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}