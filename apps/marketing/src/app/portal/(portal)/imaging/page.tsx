"use client";

// Imaging hub. Two modes selected by the URL:
//
//   /portal/imaging?patientId=<id>[&modality=&from=&to=&q=]
//     → shows that patient's studies (used by the records-tab
//       "View imaging" deep link and the patient chart tab)
//
//   /portal/imaging?q=<uid or body part>[&from=&to=&modality=]
//     → landing mode: surface the search scope so doctors can find a
//       study from any patient on their panel without first navigating
//       to that patient
//
// Both branches consume the same /imaging/studies endpoint with the
// same filter shape (patientId is just one of the inputs).

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { ScanLine, Search } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { StudyList } from "@/portal/components/imaging/StudyList";
import { useT } from "@/portal/i18n";

const MODALITIES = ["", "CT", "MR", "XR", "US", "PT"];
const DATE_RANGES = ["all", "7d", "30d", "90d", "1y"];

function dateFromRange(range: string): string | undefined {
  if (range === "all") return undefined;
  const days =
    range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function ImagingHubInner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const patientId = params?.get("patientId") ?? "";
  const initialModality = params?.get("modality") ?? "";
  const initialFrom = params?.get("from") ?? "";
  const initialTo = params?.get("to") ?? "";
  const initialQ = params?.get("q") ?? "";

  const [modality, setModality] = useState(initialModality);
  const [dateRange, setDateRange] = useState(
    DATE_RANGES.find((r) => (r === "all" ? !initialFrom : true)) ?? "all"
  );
  const [q, setQ] = useState(initialQ);

  const computedFrom =
    initialFrom || (dateRange === "all" ? "" : dateFromRange(dateRange) ?? "");

  // Search mode kicks in when there's no patientId but the doctor has
  // typed a StudyInstanceUID pattern or a body part keyword. We pull
  // accessible patients from the existing search and dispatch one
  // /imaging/studies call per patient, then merge. For a small panel
  // (typical O(200)) this is fine; if the panel grows beyond ~500 we
  // can switch the API to a server-side q=search over studies directly.
  const isSearchMode = !patientId && (q.trim().length > 0);

  const { data: accessiblePatients } = useQuery({
    queryKey: ["imaging", "landing-search", q],
    queryFn: () =>
      api<{ patients: Array<{ id: string; name: string }> }>(
        `/doctor/search-patients?q=${encodeURIComponent(q)}&limit=10`
      ),
    enabled: isSearchMode && q.trim().length >= 2,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("imaging.hub.title")}
        subtitle={t("imaging.hub.subtitle")}
        icon={<ScanLine size={18} className="text-amber-600" />}
      />

      {/* Search + filters bar */}
      <Card padding={false} className="rounded-2xl">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-border/50">
          <Search size={14} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("imaging.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                router.replace("/portal/imaging");
              }}
              className="text-xs text-text-muted hover:text-text"
            >
              {t("common.clear")}
            </button>
          )}
        </div>
        <div className="px-3 py-2 flex flex-wrap gap-3 items-center border-b border-border/50">
          <div className="flex flex-wrap gap-1.5">
            {MODALITIES.map((m) => (
              <button
                key={m || "all"}
                type="button"
                onClick={() => setModality(m)}
                className={
                  modality === m
                    ? "px-2.5 h-7 rounded-xl text-xs border bg-sky-50 text-sky-700 border-sky-200/60"
                    : "px-2.5 h-7 rounded-xl text-xs border bg-surface text-text-soft border-border/60 hover:bg-surface-2/40"
                }
              >
                {m ? m : t("common.all")}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                className={
                  dateRange === r
                    ? "px-2.5 h-7 rounded-xl text-xs border bg-amber-50 text-amber-700 border-amber-200/60"
                    : "px-2.5 h-7 rounded-xl text-xs border bg-surface text-text-soft border-border/60 hover:bg-surface-2/40"
                }
              >
                {t(`imaging.dateRange.${r}`)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {patientId ? (
        <StudyList
          patientId={patientId}
          mode="patientChart"
          modality={modality || undefined}
          from={computedFrom || undefined}
          to={initialTo || undefined}
          q={q || undefined}
          detailHrefBase="/portal/imaging"
        />
      ) : isSearchMode ? (
        accessiblePatients?.patients?.length ? (
          <div className="flex flex-col gap-4">
            {accessiblePatients.patients.map((p) => (
              <div key={p.id} className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-text-muted">
                  {p.name}
                </h3>
                <StudyList
                  patientId={p.id}
                  mode="patientChart"
                  modality={modality || undefined}
                  from={computedFrom || undefined}
                  to={initialTo || undefined}
                  q={q || undefined}
                  detailHrefBase="/portal/imaging"
                />
              </div>
            ))}
          </div>
        ) : (
          <Card padding={false} className="rounded-2xl">
            <Empty
              title={t("imaging.hub.noPatient")}
              className="py-12"
            />
          </Card>
        )
      ) : (
        <Card padding={false} className="rounded-2xl">
          <Empty title={t("imaging.hub.noPatient")} className="py-12" />
        </Card>
      )}
    </div>
  );
}

export default function ImagingHubPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <ImagingHubInner />
    </Suspense>
  );
}