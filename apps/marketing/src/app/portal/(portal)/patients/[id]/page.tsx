"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, FlaskConical, ChevronDown, ChevronRight } from "lucide-react";

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

interface RecordsResponse {
  records: RecordRow[];
  total: number;
}

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
    queryFn: () =>
      api<RecordsResponse>(
        `/doctor-portal/records?patientId=${id}&limit=50${type ? `&type=${type}` : ""}`
      ),
  });

  const records = data?.records ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card padding={false}>
        <div className="px-4 py-3 flex flex-wrap items-center gap-1.5">
          {TYPES.map((tt) => {
            const active = tt.key === type;
            return (
              <button
                key={tt.key || "all"}
                type="button"
                onClick={() => setType(tt.key)}
                className={cn(
                  "px-2.5 h-7 rounded-md text-xs border transition-colors",
                  active
                    ? "bg-brand-soft text-brand border-brand/30"
                    : "bg-surface text-text-soft border-border hover:bg-surface-2"
                )}
              >
                {t(tt.labelKey)}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : records.length === 0 ? (
          <Empty title={t("records.empty")} />
        ) : (
          <ul className="flex flex-col">
            {records.map((r) => {
              const isOpen = expanded === r.id;
              const Icon = r.recordType === "lab_report" ? FlaskConical : FileText;
              return (
                <li key={r.id} className="border-b border-border last:border-0 py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full flex items-center gap-2 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown size={14} className="text-text-muted" />
                    ) : (
                      <ChevronRight size={14} className="text-text-muted" />
                    )}
                    <Icon size={14} className="text-text-soft shrink-0" />
                    <span className="text-sm font-medium text-text truncate flex-1">
                      {r.title ?? r.recordType}
                    </span>
                    <Pill tone="neutral">{r.recordType.replace(/_/g, " ")}</Pill>
                    {r.date ? (
                      <span className="text-xs text-text-muted shrink-0">
                        {formatDate(r.date)}
                      </span>
                    ) : null}
                    {r.attachments.count > 0 ? (
                      <Pill tone="brand">{r.attachments.count} files</Pill>
                    ) : null}
                  </button>
                  {isOpen ? (
                    <div className="mt-2 pl-6 flex flex-col gap-1 text-xs">
                      {r.diagnosis ? (
                        <div>
                          <span className="text-text-muted">Dx:</span> {r.diagnosis}
                        </div>
                      ) : null}
                      {r.summary ? (
                        <div className="text-text-soft whitespace-pre-wrap">
                          {r.summary}
                        </div>
                      ) : null}
                      {r.notes ? (
                        <div className="text-text-soft whitespace-pre-wrap">
                          {r.notes}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}