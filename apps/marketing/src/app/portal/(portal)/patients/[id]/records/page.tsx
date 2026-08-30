"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, Sparkles, ScanLine, X } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton } from "@/portal/components/ui/Empty";
import { AiExplainLabDrawer } from "@/portal/components/ai/AiExplainLabDrawer";
import { RecordUploader } from "@/portal/components/upload/RecordUploader";
import { SnapshotPanel } from "@/portal/components/records/SnapshotPanel";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import {
  ChartTabHeader,
  ChartRow,
  ChartEmpty,
  FilterPills,
} from "@/portal/components/chart";

const TYPE_FILTERS = [
  { value: "all", labelKey: "recordTypes.all" },
  { value: "lab_report", labelKey: "recordTypes.lab_report" },
  { value: "imaging", labelKey: "recordTypes.imaging" },
  { value: "prescription", labelKey: "recordTypes.prescription" },
  { value: "discharge_summary", labelKey: "recordTypes.discharge_summary" },
  { value: "other", labelKey: "recordTypes.other" },
] as const;

const TYPE_TONE: Record<string, "info" | "success" | "warn" | "violet" | "neutral"> = {
  lab_report: "info",
  imaging: "warn",
  prescription: "success",
  discharge_summary: "violet",
  consultation: "neutral",
  other: "neutral",
};

interface MedicalRecord {
  id: string;
  title?: string | null;
  kind?: string | null;
  recordType: string;
  diagnosis?: string | null;
  date?: string | null;
  createdAt: string;
  hospitalName?: string | null;
  doctorName?: string | null;
}

export default function PatientRecordsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [explainFor, setExplainFor] = useState<{
    id: string;
    patientId: string;
    tests: string[];
    notes: string | null;
    resultUrl: null;
    resultSummary: string | null;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "records", { type, q: search }],
    queryFn: () => {
      const p = new URLSearchParams({
        patientId: id,
        limit: "100",
      });
      if (type !== "all") p.set("type", type);
      if (search.trim()) p.set("q", search.trim());
      return api<{ records: MedicalRecord[]; total: number }>(
        `/doctor-portal/records?${p.toString()}`
      );
    },
  });

  const records = data?.records ?? [];
  const total = data?.total ?? records.length;

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        title={t("chart.tab.records")}
        subtitle={t("chart.recordsSubtitle", { count: total })}
        icon={<FileText size={18} />}
        badge={{ count: total, tone: "brand" }}
      />

      {/* Doctor-side patient snapshot panel */}
      <SnapshotPanel patientId={id} compact />

      {/* Record Uploader Dropzone */}
      <RecordUploader patientId={id} />

      {/* High-Contrast Search & Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("chart.recordsSearchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <FilterPills
          options={TYPE_FILTERS.map((f) => ({
            value: f.value,
            label: t(f.labelKey),
          }))}
          value={type}
          onChange={(v) => setType(v)}
        />
      </div>

      {/* Records Listing */}
      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-2xs">
          <ChartEmpty
            title={t("chart.recordsEmpty")}
            description={t("chart.recordsEmptyBody")}
            action={
              search ? (
                <Button variant="secondary" onClick={() => setSearch("")}>
                  {t("common.clear")}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {records.map((r) => {
              const meta = [
                r.diagnosis,
                r.hospitalName,
                r.doctorName,
                r.date ? formatDate(r.date) : formatDate(r.createdAt),
              ]
                .filter(Boolean)
                .join(" · ");
              const recordKind = r.kind || r.recordType;
              return (
                <li key={r.id}>
                  <ChartRow
                    icon={<FileText size={18} />}
                    iconTone={TYPE_TONE[recordKind] ?? "neutral"}
                    title={r.title || t("chart.recordsUntitled")}
                    meta={meta}
                    actions={
                      <div className="flex items-center gap-1.5">
                        {recordKind === "lab_report" ? (
                          <button
                            type="button"
                            aria-label={t("ai.labExplain.title")}
                            title={t("ai.labExplain.title")}
                            onClick={() =>
                              setExplainFor({
                                id: r.id,
                                patientId: id,
                                tests: r.title
                                  ? r.title.split(/[·,;]/).map((s) => s.trim()).filter(Boolean)
                                  : [r.title || t("chart.recordsUntitled")],
                                notes: r.diagnosis ?? null,
                                resultUrl: null,
                                resultSummary: r.diagnosis ?? null,
                              })
                            }
                            className="p-1.5 rounded-lg text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer"
                          >
                            <Sparkles size={14} />
                          </button>
                        ) : null}
                        {recordKind === "imaging" ? (
                          <Link
                            href={`/portal/imaging?patientId=${id}`}
                            aria-label={t("imaging.openViewer")}
                            title={t("imaging.openViewer")}
                            className="p-1.5 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                          >
                            <ScanLine size={14} />
                          </Link>
                        ) : null}
                        <Pill tone="neutral">
                          {t(`recordTypes.${recordKind}`) || recordKind}
                        </Pill>
                      </div>
                    }
                    hideChevron
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {explainFor ? (
        <AiExplainLabDrawer
          labOrder={explainFor}
          onClose={() => setExplainFor(null)}
        />
      ) : null}
    </div>
  );
}