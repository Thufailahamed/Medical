"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, FlaskConical, ChevronDown, ChevronRight, Calendar } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface RecordRow {
  id: string;
  recordType: string;
  title: string | null;
  diagnosis?: string | null;
  summary?: string | null;
  notes?: string | null;
  date?: string | null;
  attachments: { count: number };
}

interface RecordsResponse { records: RecordRow[]; total: number }

const TYPES = [
  { key: "", labelKey: "records.filterAll" },
  { key: "prescription", labelKey: "records.kindPrescription" },
  { key: "lab_report", labelKey: "records.kindLabOrder" },
  { key: "diagnosis", labelKey: "records.kindDiagnosis" },
  { key: "discharge_summary", labelKey: "records.kindNote" },
];

export default function PatientRecordsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const [type, setType] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "records", id, type],
    queryFn: () => api<RecordsResponse>(`/doctor-portal/records?patientId=${id}&limit=50${type ? `&type=${type}` : ""}`),
  });

  const records = data?.records ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TYPES.map((tt) => {
          const active = tt.key === type;
          return (
            <button key={tt.key || "all"} type="button" onClick={() => setType(tt.key)} className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200",
              active ? "bg-brand text-white border-brand shadow-sm" : "bg-surface text-text-soft border-border/80 hover:bg-surface-2 hover:border-border"
            )}>{t(tt.labelKey)}</button>
          );
        })}
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-3/4" />
          </div>
        ) : records.length === 0 ? (
          <Empty title={t("records.empty")} icon={<FileText size={20} className="text-text-muted" />} className="py-12" />
        ) : (
          <ul className="flex flex-col">
            {records.map((r) => {
              const isOpen = expanded === r.id;
              const Icon = r.recordType === "lab_report" ? FlaskConical : FileText;
              return (
                <li key={r.id} className="border-b border-border/50 last:border-0">
                  <button type="button" onClick={() => setExpanded(isOpen ? null : r.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/30 transition-colors group">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", r.recordType === "lab_report" ? "bg-amber-50 text-amber-600" : "bg-sky-50 text-sky-600")}>
                      <Icon size={14} />
                    </div>
                    <span className="text-sm font-medium text-text truncate flex-1">{r.title ?? r.recordType}</span>
                    <Pill tone="neutral">{r.recordType.replace(/_/g, " ")}</Pill>
                    {r.date && (
                      <span className="text-[11px] text-text-muted shrink-0 flex items-center gap-1">
                        <Calendar size={10} />{formatDate(r.date)}
                      </span>
                    )}
                    {r.attachments.count > 0 && <Pill tone="brand">{r.attachments.count} files</Pill>}
                    {isOpen ? <ChevronDown size={14} className="text-text-muted shrink-0" /> : <ChevronRight size={14} className="text-text-muted/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 pl-[68px] flex flex-col gap-2 text-xs animate-in">
                      {r.diagnosis && (
                        <div className="p-2.5 rounded-xl bg-surface-2/40 border border-border/40">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">Dx</span>
                          <div className="text-text-soft mt-0.5">{r.diagnosis}</div>
                        </div>
                      )}
                      {r.summary && <div className="text-text-soft whitespace-pre-wrap leading-relaxed">{r.summary}</div>}
                      {r.notes && <div className="text-text-muted whitespace-pre-wrap leading-relaxed">{r.notes}</div>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
