"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Loader2, Check, AlertCircle, CloudUpload } from "lucide-react";

import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";

interface UploadResult {
  record: { id: string; kind?: string; recordType?: string };
  file: { id: string; r2Key: string; fileName: string };
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_BYTES = 50 * 1024 * 1024;

interface Props {
  patientId: string;
  defaultKind?: string;
  onUploaded?: (result: UploadResult) => void;
  className?: string;
}

export function RecordUploader({
  patientId,
  defaultKind = "other",
  onUploaded,
  className,
}: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("patientId", patientId);
      fd.append("recordType", defaultKind);
      fd.append("kind", defaultKind);
      fd.append("title", file.name.replace(/\.[^.]+$/, ""));
      fd.append("date", new Date().toISOString().slice(0, 10));
      fd.append("file", file);
      return api<UploadResult>("/files/upload-with-record", {
        method: "POST",
        body: fd as any,
        headers: {},
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "records"] });
      qc.invalidateQueries({
        queryKey: ["doctor-portal", "patient", patientId, "records"],
      });
      qc.invalidateQueries({ queryKey: ["medical-records"] });
      setLastSuccess(`Successfully uploaded ${result.file.fileName}`);
      setLastError(null);
      onUploaded?.(result);
      setTimeout(() => setLastSuccess(null), 4000);
    },
    onError: (err: any) => {
      setLastError(err?.message || "Upload failed");
      setLastSuccess(null);
    },
  });

  function validateAndStart(file: File) {
    setLastError(null);
    if (file.size > MAX_BYTES) {
      setLastError("File too large (max 50 MB)");
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setLastError("Unsupported file type. Please use PDF, JPEG, PNG, or WebP.");
      return;
    }
    upload.mutate(file);
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files?.[0];
        if (file) validateAndStart(file);
      }}
      className={cn(
        "rounded-2xl border-2 border-dashed p-6 text-center transition-all shadow-2xs",
        drag
          ? "border-sky-500 bg-sky-100/60"
          : "border-sky-200/90 bg-sky-50/35 hover:bg-sky-50/60 hover:border-sky-300",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) validateAndStart(file);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-2.5">
        <div className="h-12 w-12 rounded-2xl bg-white border border-sky-100 text-sky-600 shadow-2xs flex items-center justify-center">
          {upload.isPending ? (
            <Loader2 size={22} className="animate-spin text-sky-600" />
          ) : (
            <CloudUpload size={22} />
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">
            {upload.isPending
              ? "Encrypting and Uploading Medical Record…"
              : "Drop patient documents here, or browse files"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Diagnostic reports, lab results, discharge summaries, or clinical charts · PDF, JPEG, PNG up to 50 MB
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 mt-1"
          style={{
            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
          }}
        >
          <FileText size={14} />
          <span>Choose Medical File</span>
        </button>

        {lastSuccess && (
          <div className="mt-1 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
            <Check size={13} strokeWidth={3} className="text-emerald-600" />
            <span>{lastSuccess}</span>
          </div>
        )}
        {lastError && (
          <div className="mt-1 px-3 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5 shadow-2xs">
            <AlertCircle size={13} className="text-rose-600" />
            <span>{lastError}</span>
          </div>
        )}
      </div>
    </div>
  );
}