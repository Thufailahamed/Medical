"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Loader2, Check, AlertCircle } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
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
  /** Default record kind when uploading. */
  defaultKind?: string;
  /** Called when a record is successfully created. */
  onUploaded?: (result: UploadResult) => void;
  className?: string;
}

/**
 * Minimal upload component for the doctor records tab. Wraps the
 * /files/upload-with-record endpoint so a single drag-drop or click
 * creates a new medical record + R2 attachment in one round-trip.
 *
 * Use the existing /files/upload-with-record flow rather than a
 * two-step create-then-upload to keep the doctor's flow fast.
 */
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
      setLastSuccess(`Uploaded ${result.file.fileName}`);
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
      setLastError("Unsupported file type. Use PDF, JPEG, PNG, or WebP.");
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
        "rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
        drag
          ? "border-primary bg-primary-soft/40"
          : "border-border bg-surface-1",
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
      <div className="flex flex-col items-center gap-2">
        {upload.isPending ? (
          <Loader2 size={20} className="text-primary animate-spin" />
        ) : (
          <Upload size={20} className="text-text-muted" />
        )}
        <p className="text-sm text-text">
          {upload.isPending
            ? "Uploading…"
            : "Drop a record here, or click to browse"}
        </p>
        <p className="text-xs text-text-soft">PDF, JPEG, PNG, WebP · up to 50 MB</p>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<FileText size={13} />}
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          Choose file
        </Button>
        {lastSuccess ? (
          <Pill tone="success" className="mt-2">
            <Check size={11} className="inline mr-1" />
            {lastSuccess}
          </Pill>
        ) : null}
        {lastError ? (
          <Pill tone="danger" className="mt-2">
            <AlertCircle size={11} className="inline mr-1" />
            {lastError}
          </Pill>
        ) : null}
      </div>
    </div>
  );
}