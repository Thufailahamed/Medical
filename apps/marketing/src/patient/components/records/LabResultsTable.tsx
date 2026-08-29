"use client";

import { useRecordLabResults } from "@/patient/hooks";

export function LabResultsTable({ recordId }: { recordId: string }) {
  const q = useRecordLabResults(recordId);
  const items = (q.data?.items ?? []) as Array<{
    id: string;
    test: string;
    value: string;
    unit: string | null;
    referenceRange: string | null;
    flag: string | null;
    collectedAt: string;
  }>;
  if (!items.length) return <p className="t-micro">No lab results extracted yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-text-muted">
          <th className="py-1">Test</th>
          <th>Value</th>
          <th>Unit</th>
          <th>Range</th>
          <th>Flag</th>
          <th>Collected</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.id} className="border-t border-border/60">
            <td className="py-1">{row.test}</td>
            <td>{row.value}</td>
            <td>{row.unit ?? ""}</td>
            <td>{row.referenceRange ?? ""}</td>
            <td>{row.flag ?? ""}</td>
            <td>{new Date(row.collectedAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}