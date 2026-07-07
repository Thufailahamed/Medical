"use client";

// portal/components/admin/ExportButton.tsx
//
// Dropdown that triggers a CSV/JSON download from an
// /admin/export/* endpoint. We use `adminDownload` (the fetch
// helper in admin-api) so we still pick up the admin bearer token
// + step-up header automatically.

import { useState } from "react";
import { Download, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/portal/components/ui/Button";
import { adminDownload } from "@/portal/lib/admin-api";

interface ExportButtonProps {
  /** Path after /admin/export, e.g. "users" or "audit" or "approvals" or "notes". */
  exportPath: string;
  /** Filters forwarded as query params. */
  filters?: Record<string, string | undefined>;
  /** Override the default filename; usually left blank so the server's
   * `Content-Disposition` header wins. */
  filename?: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
}

export function ExportButton({
  exportPath,
  filters = {},
  filename,
  label = "Export",
  size = "sm",
  variant = "secondary",
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"csv" | "json" | null>(null);

  async function trigger(format: "csv" | "json") {
    setBusy(format);
    setOpen(false);
    try {
      const qs = new URLSearchParams();
      qs.set("format", format);
      for (const [k, v] of Object.entries(filters)) {
        if (v != null && v !== "") qs.set(k, v);
      }
      const { blob, filename: dlName } = await adminDownload(
        `/admin/export/${exportPath}?${qs.toString()}`,
        filename,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dlName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <Button
        size={size}
        variant={variant}
        onClick={() => setOpen((v) => !v)}
        disabled={busy != null}
      >
        <Download size={14} className="mr-1" />
        {busy ? `Exporting ${busy.toUpperCase()}…` : label}
        <ChevronDown size={14} className="ml-1" />
      </Button>
      {open ? (
        <div
          className="absolute right-0 mt-1 w-44 bg-surface border border-border rounded-xl shadow-lg z-30 overflow-hidden"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 flex items-center gap-2"
            onClick={() => trigger("csv")}
          >
            <FileText size={14} />Download CSV
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 flex items-center gap-2"
            onClick={() => trigger("json")}
          >
            <FileText size={14} />Download NDJSON
          </button>
        </div>
      ) : null}
    </div>
  );
}