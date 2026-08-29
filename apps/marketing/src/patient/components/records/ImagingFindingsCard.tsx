"use client";

import { useRecordImagingFindings } from "@/patient/hooks";

export function ImagingFindingsCard({ recordId }: { recordId: string }) {
  const q = useRecordImagingFindings(recordId);
  const item = q.data?.item as
    | { id: string; modality?: string; impression?: string }
    | null
    | undefined;
  if (!item) return <p className="t-micro">No imaging findings extracted yet.</p>;
  return (
    <div className="flex flex-col gap-2 rounded-inner bg-surface-2 p-3">
      <p className="text-sm font-medium">{item.modality ?? "Imaging"}</p>
      {item.impression ? (
        <p className="t-micro">{item.impression}</p>
      ) : null}
    </div>
  );
}