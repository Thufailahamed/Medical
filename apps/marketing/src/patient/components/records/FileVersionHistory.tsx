"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/portal/lib/api";

interface FileRow {
  id: string;
  fileName: string;
  version?: number | null;
  changeReason?: string | null;
  createdAt: string;
  fileSize?: number | null;
  mimeType?: string | null;
}

/** Attachment version chain — replaces never silently overwrite. */
export function FileVersionHistory({ fileId }: { fileId: string }) {
  const q = useQuery({
    queryKey: ["file-versions", fileId],
    queryFn: () => api<{ items: FileRow[] }>(`/files/${fileId}/versions`),
  });
  const items = [...(q.data?.items ?? [])].sort(
    (a, b) => Number(b.version || 1) - Number(a.version || 1)
  );
  if (q.isLoading) return <p className="t-micro">Loading file versions…</p>;
  if (q.isError) return <p className="t-micro text-red-600">Could not load file versions.</p>;
  if (items.length <= 1) return <p className="t-micro">Single version — current.</p>;
  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((f, i) => (
        <li key={f.id} className="rounded-inner bg-surface-2 px-2.5 py-1.5">
          <p className="text-xs font-medium">
            v{f.version || 1} — {f.fileName}{i === 0 ? " (current)" : ""}
          </p>
          <p className="t-micro">
            {new Date(f.createdAt).toLocaleString()}
            {f.changeReason ? ` · ${f.changeReason}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
