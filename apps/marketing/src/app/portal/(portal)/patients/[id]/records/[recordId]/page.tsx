"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";
import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { RecordVersionHistory } from "@/patient/components/records/RecordVersionHistory";
import { DocumentPreview } from "@/patient/components/records/DocumentPreview";
import { formatDate } from "@/portal/lib/format";

interface DetailFile {
  id: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  version?: number | null;
}

export default function DoctorRecordDetailPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = use(params);
  const q = useQuery({
    queryKey: ["doctor-portal", "record", recordId],
    queryFn: () => api<{ record: any }>(`/medical-records/${recordId}`),
  });
  const record = q.data?.record;
  const files: DetailFile[] = record?.files ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/portal/patients/${id}/records`} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={14} /> Back to records
      </Link>
      {q.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : q.isError || !record ? (
        <p className="text-sm text-red-600">Could not load record.</p>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">{record.recordType}</p>
            <h1 className="mt-1 text-lg font-bold">{record.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{record.date ? formatDate(record.date) : ""}</p>
            {record.diagnosis ? <p className="mt-3 text-sm">{record.diagnosis}</p> : null}
            {record.summary ? <p className="mt-2 text-sm text-slate-600">{record.summary}</p> : null}
            <div className="mt-3">
              <Pill tone="neutral">{record.status ?? "active"}</Pill>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold">Attachments ({files.length})</h2>
            {files.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No attachments.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="flex items-center gap-2 truncate text-sm">
                      <FileText size={14} />
                      {f.fileName}
                      {f.version && f.version > 1 ? <span className="text-xs text-slate-500">v{f.version}</span> : null}
                    </span>
                    <DocumentPreview fileId={f.id} fileName={f.fileName} mimeType={f.mimeType} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <RecordVersionHistory recordId={recordId} />
          </div>
        </>
      )}
    </div>
  );
}
