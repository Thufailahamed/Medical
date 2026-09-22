"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/portal/lib/api";

interface Revision {
  id: string;
  revisionNumber: number;
  editedByUserId?: string | null;
  editedAt?: string | null;
  diffSummary?: string | null;
}

function parseDiff(s?: string | null): string[] {
  if (!s) return [];
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j.changed)) return j.changed;
    if (typeof j === "object") return Object.keys(j);
    return [];
  } catch {
    return [];
  }
}

/** Record metadata version history — every PATCH writes a revision row. */
export function RecordVersionHistory({ recordId }: { recordId: string }) {
  const q = useQuery({
    queryKey: ["record-revisions", recordId],
    queryFn: () => api<{ items: Revision[] }>(`/medical-records/${recordId}/revisions`),
  });
  const items = [...(q.data?.items ?? [])].sort(
    (a, b) => Number(b.revisionNumber || 0) - Number(a.revisionNumber || 0)
  );
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <h2 className="t-section-title">Version history</h2>
        <span className="t-micro">{items.length} version{items.length === 1 ? "" : "s"}</span>
      </header>
      {q.isLoading ? (
        <p className="t-micro">Loading versions…</p>
      ) : q.isError ? (
        <p className="t-micro text-red-600">Could not load version history.</p>
      ) : items.length === 0 ? (
        <p className="t-micro">No edits yet — the original record is current.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((r, i) => (
            <li key={r.id} className="rounded-inner bg-surface-2 px-3 py-2">
              <p className="text-sm font-medium">
                Version {r.revisionNumber}
                {i === 0 ? " — Current" : ""}
              </p>
              <p className="t-micro">
                {r.editedAt ? new Date(r.editedAt).toLocaleString() : ""}
                {r.editedByUserId ? ` · edited by ${r.editedByUserId.slice(0, 8)}` : ""}
              </p>
              {parseDiff(r.diffSummary).length > 0 ? (
                <p className="t-micro mt-1">Changed: {parseDiff(r.diffSummary).join(", ")}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
