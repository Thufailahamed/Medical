"use client";

import { useState } from "react";
import Link from "next/link";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import {
  useDsarErasure,
  useDsarExport,
  useDsarJobs,
  useDsarRectification,
} from "@/patient/hooks";

export default function DsarPage() {
  const jobs = useDsarJobs();
  const exportJob = useDsarExport();
  const erasure = useDsarErasure();
  const rectification = useDsarRectification();

  const [notes, setNotes] = useState("");
  const [rectRecordId, setRectRecordId] = useState("");
  const [rectField, setRectField] = useState("title");
  const [rectValue, setRectValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function run(
    action: () => Promise<unknown>,
    okMessage: string,
  ) {
    setError(null);
    setStatus(null);
    try {
      await action();
      setStatus(okMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Privacy"
        title="Data subject requests"
        description="Request a formal DSAR export, rectification, or erasure under applicable privacy law."
        action={
          <Link
            href="/patient/export"
            className="rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-text-soft"
          >
            Quick export
          </Link>
        }
      />

      <Card>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-text">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-inner border border-border bg-surface-2 px-3 py-2 font-normal"
              placeholder="Reason or context for the request"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {status ? (
            <p role="status" className="text-sm font-semibold text-success">
              {status}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exportJob.isPending}
              onClick={() =>
                run(() => exportJob.mutateAsync(), "DSAR export requested.")
              }
              className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {exportJob.isPending ? "Requesting…" : "Request DSAR export"}
            </button>
            <button
              type="button"
              disabled={erasure.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    "Request erasure of your personal data? This starts a formal review process.",
                  )
                ) {
                  return;
                }
                run(
                  () => erasure.mutateAsync(notes || undefined),
                  "Erasure request submitted.",
                );
              }}
              className="rounded-pill bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
            >
              {erasure.isPending ? "Submitting…" : "Request erasure"}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Rectification</h2>
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                rectification.mutateAsync({
                  fields: [
                    {
                      recordId: rectRecordId.trim(),
                      field: rectField.trim(),
                      proposedValue: rectValue.trim(),
                    },
                  ],
                  notes: notes || undefined,
                }),
              "Rectification request submitted.",
            );
          }}
        >
          <input
            required
            value={rectRecordId}
            onChange={(e) => setRectRecordId(e.target.value)}
            placeholder="Record ID"
            className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm"
          />
          <input
            required
            value={rectField}
            onChange={(e) => setRectField(e.target.value)}
            placeholder="Field name"
            className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm"
          />
          <input
            required
            value={rectValue}
            onChange={(e) => setRectValue(e.target.value)}
            placeholder="Proposed value"
            className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm"
          />
          <button
            type="submit"
            disabled={rectification.isPending}
            className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3 sm:justify-self-start"
          >
            {rectification.isPending ? "Submitting…" : "Request rectification"}
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Request history</h2>
        <QueryBoundary
          query={jobs}
          loadingCount={3}
          emptyTitle="No DSAR jobs yet"
          emptyDescription="Submitted requests will show their status here."
          isEmpty={(data) => !data.items?.length}
        >
          {(data) => (
            <ul className="flex flex-col gap-2">
              {data.items.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center gap-3 rounded-inner bg-surface-2 px-3 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold capitalize text-text">
                      {job.type}
                    </span>
                    <span className="text-xs text-text-soft">
                      {new Date(job.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <Pill
                    tone={
                      job.status === "completed"
                        ? "success"
                        : job.status === "failed"
                          ? "danger"
                          : "info"
                    }
                  >
                    {job.status}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}
