"use client";

import { useState } from "react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api } from "@/portal/lib/api";
import { useQuery } from "@tanstack/react-query";
import { usePatientProfile } from "@/patient/hooks";

export default function AiToolsPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const summary = useQuery({
    queryKey: ["patient", "ai", "summary", patientId],
    queryFn: () => api<{ summary: string }>("/ai/summary", { method: "POST", json: { patientId } }),
    enabled: false,
  });
  const [medicines, setMedicines] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDrugCheck() {
    setError(null);
    setAnswer(null);
    const names = medicines.split(",").map((value) => value.trim()).filter(Boolean);
    if (!names.length) return;
    try {
      const result = await api<{ result?: string; interactions?: unknown[] }>("/ai/drug-interaction", { method: "POST", json: { medicines: names } });
      setAnswer(result.result ?? JSON.stringify(result.interactions ?? result));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI check failed.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader label="Care assistant" title="AI health tools" description="Use supported summaries and safety checks alongside your care team." />
      <Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-text">Health summary</h2>
          <p className="text-sm text-text-soft">Generate a plain-language summary from your current health record.</p>
          {summary.error ? <p role="alert" className="text-sm text-danger">{summary.error instanceof Error ? summary.error.message : "Could not generate summary."}</p> : null}
          {summary.data?.summary ? <p className="rounded-inner bg-surface-2 p-3 text-sm leading-relaxed text-text">{summary.data.summary}</p> : null}
          <button type="button" onClick={() => summary.refetch()} disabled={summary.isFetching} className="self-start rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{summary.isFetching ? "Generating…" : "Generate summary"}</button>
        </div>
      </Card>
      <Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-text">Medication safety check</h2>
          <p className="text-sm text-text-soft">Enter medicines separated by commas. This does not replace a clinician or pharmacist.</p>
          <input value={medicines} onChange={(event) => setMedicines(event.target.value)} placeholder="e.g. aspirin, ibuprofen" className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand" />
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{answer ? <pre className="whitespace-pre-wrap rounded-inner bg-surface-2 p-3 text-sm text-text">{answer}</pre> : null}
          <button type="button" onClick={runDrugCheck} disabled={!medicines.trim()} className="self-start rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Check interactions</button>
        </div>
      </Card>
    </div>
  );
}
