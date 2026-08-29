"use client";

import { useState } from "react";
import Link from "next/link";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api } from "@/portal/lib/api";

const FORMATS = ["json", "txt", "fhir-bundle"] as const;
type ExportFormat = (typeof FORMATS)[number];

export default function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api<string>(`/export/me?format=${format}`);
      const blob = new Blob([payload], {
        type: format === "txt" ? "text/plain" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `healthhub-export-${new Date().toISOString().slice(0, 10)}.${format === "txt" ? "txt" : "json"}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create your export.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Your data"
        title="Export"
        description="Download a complete copy of the health data available to you."
      />
      <Card>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold text-text">
            Format
            <select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as ExportFormat)
              }
              className="h-11 rounded-inner border border-border bg-surface-2 px-3 font-normal"
            >
              {FORMATS.map((value) => (
                <option key={value} value={value}>
                  {value === "fhir-bundle" ? "FHIR bundle" : value.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-text-soft">
            The export is downloaded directly from the API and is not truncated
            in the browser.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={download}
            disabled={loading}
            className="self-start rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Preparing…" : "Download my data"}
          </button>
          <p className="text-sm text-text-soft">
            Need a formal privacy request (erasure or rectification)?{" "}
            <Link href="/patient/dsar" className="font-semibold text-brand">
              Open data subject requests
            </Link>
            .
          </p>
        </div>
      </Card>
    </div>
  );
}
