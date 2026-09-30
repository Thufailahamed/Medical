"use client";

import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ScanLine,
  ShieldCheck,
  X,
  User,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Activity,
  Layers,
  Cpu,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { StudyList } from "@/portal/components/imaging/StudyList";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { usePatientHeader } from "@/portal/components/patient/PatientHeader";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";
import { ageFrom, formatDate } from "@/portal/lib/format";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  ROW_LINK,
  RowAccent,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";

interface ImagingRecord {
  id: string;
  patientId: string;
  title: string;
  date: string | null;
  createdAt: string;
  patient: { id: string; name: string } | null;
}

function stampOf(r: ImagingRecord) {
  const t = Date.parse(r.date ?? r.createdAt);
  return isNaN(t) ? 0 : t;
}

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
  const [now] = useState(() => Date.now());

  const computedFrom =
    initialFrom || (dateRange === "all" ? "" : dateFromRange(dateRange) ?? "");

  // Load patient header info if patientId is present
  const { data: patientData } = usePatientHeader(patientId);

  // Search mode kicks in when there's no patientId but the doctor has
  // typed a StudyInstanceUID pattern or a body part keyword.
  const isSearchMode = !patientId && q.trim().length > 0;

  const { data: accessiblePatients } = useQuery({
    queryKey: ["imaging", "landing-search", q],
    queryFn: () =>
      api<{ patients: Array<{ id: string; name: string }> }>(
        `/doctor/search-patients?q=${encodeURIComponent(q)}&limit=10`
      ),
    enabled: isSearchMode && q.trim().length >= 2,
  });

  // Recent patients for quick-selection on empty landing view
  const { data: recentPatientsData } = useQuery({
    queryKey: ["imaging", "recent-patients-quick"],
    queryFn: () =>
      api<{
        patients: Array<{
          patient: { id: string; nic?: string | null; dob?: string | null; sex?: string | null; photo?: string | null };
          user: { id: string; name: string };
        }>;
      }>("/doctor/search-patients?q=&limit=6"),
    enabled: !patientId && !isSearchMode,
  });

  const recentList = recentPatientsData?.patients ?? [];

  // Imaging records power the stat strip + the recent-studies feed.
  const { data: imagingRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ["doctor-portal", "records", "imaging-hub"],
    queryFn: () =>
      api<{ records: ImagingRecord[]; total: number }>("/doctor-portal/records?type=imaging&limit=200"),
    staleTime: 60_000,
  });

  const studies = useMemo(
    () =>
      (imagingRecords?.records ?? [])
        .slice()
        .sort((a, b) => stampOf(b) - stampOf(a)),
    [imagingRecords],
  );
  const last7 = studies.filter((r) => stampOf(r) >= now - 7 * 86_400_000).length;
  const last30 = studies.filter((r) => stampOf(r) >= now - 30 * 86_400_000).length;
  const patientsImaged = new Set(studies.map((r) => r.patient?.id ?? r.patientId).filter(Boolean)).size;

  const openPatient = (id: string) => router.push(`/portal/imaging?patientId=${id}`);
  const clearAll = () => {
    setQ("");
    router.replace("/portal/imaging");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<ScanLine size={13} aria-hidden />}
          kicker="PACS & imaging"
          kickerMeta="DICOMweb"
          title={
            patientId && patientData?.user?.name ? (
              <>
                Imaging for{" "}
                <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                  {patientData.user.name}
                </span>
              </>
            ) : (
              <>
                Radiology{" "}
                <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                  archive
                </span>
              </>
            )
          }
          description={
            patientId
              ? "Every DICOM study and series on file for this patient — open one to launch the Cornerstone3D viewer."
              : "Search studies across your panel, review multi-modality DICOM series and launch the diagnostic viewer."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                PACS online
              </span>
              <span className={HERO_CHIP}>
                <Cpu size={12} className="text-sky-300" aria-hidden />
                Cornerstone3D · lossless 16-bit
              </span>
            </>
          }
          actions={
            patientId ? (
              <>
                <button type="button" onClick={clearAll} className={HERO_GHOST}>
                  <X size={15} aria-hidden />
                  Switch patient
                </button>
                <Link href={`/portal/patients/${patientId}/imaging`} className={HERO_PRIMARY}>
                  <User size={15} className="text-sky-600" aria-hidden />
                  Patient chart
                </Link>
              </>
            ) : (
              <Link href="/portal/records" className={HERO_GHOST}>
                <Layers size={15} aria-hidden />
                All records
              </Link>
            )
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Studies on file"
            icon={<Layers size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={recordsLoading ? "…" : String(studies.length)}
            sub="Across your patients"
            active={dateRange === "all"}
            onClick={() => setDateRange("all")}
          />
          <StatTile
            label="Last 7 days"
            icon={<Sparkles size={16} />}
            tone="bg-rose-50 text-rose-600"
            value={String(last7)}
            sub={last7 > 0 ? "New studies to review" : "No new studies"}
            badge={last7 > 0 ? { text: "New", tone: "bg-rose-50 text-rose-600" } : undefined}
            active={dateRange === "7d"}
            onClick={() => setDateRange("7d")}
          />
          <StatTile
            label="Last 30 days"
            icon={<Activity size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(last30)}
            sub="Recent radiology"
            progress={studies.length > 0 ? Math.round((last30 / studies.length) * 100) : null}
            active={dateRange === "30d"}
            onClick={() => setDateRange("30d")}
          />
          <StatTile
            href="/portal/patients"
            label="Patients imaged"
            icon={<User size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(patientsImaged)}
            sub="With at least one study"
          />
        </HeroOverlap>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <section className={PANEL} aria-label="Imaging filters">
        <div className="flex flex-col gap-3">
          <PanelSearch
            className="lg:max-w-none"
            value={q}
            onChange={(v) => {
              setQ(v);
              if (!v && !patientId) router.replace("/portal/imaging");
            }}
            placeholder="Search Study UID, patient or body part (Chest, Brain…)"
            ariaLabel="Search imaging"
          />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Segmented<string>
              ariaLabel="Modality"
              value={modality}
              onChange={setModality}
              options={MODALITIES.map((m) => ({ value: m, label: m || t("common.all") }))}
            />
            <Segmented<string>
              ariaLabel="Timeframe"
              value={dateRange}
              onChange={setDateRange}
              options={DATE_RANGES.map((r) => ({ value: r, label: t(`imaging.dateRange.${r}`) }))}
            />
          </div>
        </div>
      </section>

      {/* ── Main content ───────────────────────────────────────────────── */}
      {patientId ? (
        <section className={PANEL} aria-labelledby="img-studies">
          <PanelHeader
            id="img-studies"
            icon={<ScanLine size={16} />}
            tone="bg-indigo-50 text-indigo-600"
            title="DICOM studies"
            caption={
              patientData
                ? [
                    patientData.patient?.sex,
                    patientData.patient?.dob ? `${ageFrom(patientData.patient.dob)}y` : null,
                    patientData.patient?.nic ? `NIC ${patientData.patient.nic}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Filtered study series"
                : "Loading patient…"
            }
            href={`/portal/patients/${patientId}/imaging`}
            linkLabel="Chart"
          />
          <StudyList
            patientId={patientId}
            mode="patientChart"
            modality={modality || undefined}
            from={computedFrom || undefined}
            to={initialTo || undefined}
            q={q || undefined}
            detailHrefBase="/portal/imaging"
            className="mt-5 overflow-hidden rounded-xl"
          />
        </section>
      ) : isSearchMode ? (
        accessiblePatients?.patients?.length ? (
          <div className="flex flex-col gap-6">
            {accessiblePatients.patients.map((p) => (
              <section key={p.id} className={PANEL} aria-label={p.name}>
                <PanelHeader
                  icon={<Avatar name={p.name} size="xs" />}
                  tone="bg-slate-50"
                  title={p.name}
                  caption="Matching studies"
                  action={
                    <button type="button" onClick={() => openPatient(p.id)} className={ROW_LINK}>
                      All studies
                      <ArrowRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
                    </button>
                  }
                />
                <StudyList
                  patientId={p.id}
                  mode="patientChart"
                  modality={modality || undefined}
                  from={computedFrom || undefined}
                  to={initialTo || undefined}
                  q={q || undefined}
                  detailHrefBase="/portal/imaging"
                  className="mt-5 overflow-hidden rounded-xl"
                />
              </section>
            ))}
          </div>
        ) : (
          <section className={PANEL}>
            <EmptyBlock
              className="mt-0"
              icon={<ScanLine size={19} />}
              title="No DICOM studies found"
              body={`Nothing matches “${q}”. Try a patient name, modality or body part.`}
              actions={
                <button type="button" onClick={clearAll} className={SECONDARY_BTN}>
                  Clear search
                </button>
              }
            />
          </section>
        )
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          {/* Recent studies feed */}
          <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="img-recent">
            <PanelHeader
              id="img-recent"
              icon={<ScanLine size={16} />}
              tone="bg-indigo-50 text-indigo-600"
              title="Recent studies"
              caption={recordsLoading ? "Loading…" : `${studies.length} imaging record${studies.length === 1 ? "" : "s"}`}
              href="/portal/records"
              linkLabel="Records"
            />
            {recordsLoading ? (
              <div className="mt-5 space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : studies.length === 0 ? (
              <EmptyBlock
                icon={<ScanLine size={19} />}
                title="No imaging yet"
                body="Studies uploaded or pulled from a connected PACS appear here. Pick a patient to browse their archive."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {studies.slice(0, 8).map((r) => {
                  const pid = r.patient?.id ?? r.patientId;
                  const fresh = stampOf(r) >= now - 7 * 86_400_000;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => pid && openPatient(pid)}
                        className={cn(LIST_ROW, "w-full cursor-pointer text-left")}
                      >
                        <RowAccent className={fresh ? "bg-rose-500" : "bg-indigo-400"} />
                        <span className="flex min-w-0 flex-1 items-center gap-3.5 pl-1.5">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-sm shadow-indigo-600/30">
                            <ScanLine size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                                {r.title}
                              </span>
                              {fresh ? <Pill tone="danger">New</Pill> : null}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                              {r.patient?.name ? (
                                <>
                                  <span className="font-medium text-slate-600">{r.patient.name}</span>
                                  <span className="text-slate-300">·</span>
                                </>
                              ) : null}
                              <span className="tabular-nums">{formatDate(r.date ?? r.createdAt)}</span>
                            </span>
                          </span>
                        </span>
                        <span className={cn(ROW_LINK, "shrink-0 self-end sm:self-center")}>
                          Open
                          <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Patient picker */}
          <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Choose patient">
            <section className={PANEL} aria-labelledby="img-pick">
              <PanelHeader
                id="img-pick"
                icon={<User size={16} />}
                tone="bg-sky-50 text-sky-600"
                title="Open a patient"
                caption="Browse their full DICOM timeline"
              />
              <div className="mt-4">
                <PatientCombobox value={null} onChange={(p) => p && openPatient(p.id)} />
              </div>
              {recentList.length > 0 ? (
                <>
                  <p className="mt-5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Recent patients
                  </p>
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {recentList.map((item) => (
                      <li key={item.patient.id}>
                        <button
                          type="button"
                          onClick={() => openPatient(item.patient.id)}
                          className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50"
                        >
                          <Avatar name={item.user.name} src={item.patient.photo ?? undefined} size="sm" className="h-8 w-8" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-slate-900 group-hover:text-sky-700">
                              {item.user.name}
                            </span>
                            {item.patient.nic ? (
                              <span className="block truncate font-mono text-[11px] text-slate-400">{item.patient.nic}</span>
                            ) : null}
                          </span>
                          <ChevronRight size={14} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>

            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white"
              style={{
                background:
                  "radial-gradient(420px 200px at 100% 0%, rgba(244,114,182,0.30), transparent 60%), radial-gradient(300px 160px at 0% 100%, rgba(129,140,248,0.25), transparent 60%), linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -18px rgba(49,46,129,0.6)",
              }}
            >
              <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden />
              <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-pink-200/80">
                Viewer
              </span>
              <p className="mt-1 text-base font-semibold tracking-[-0.01em]">Cornerstone3D diagnostic viewer</p>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
                {["CT · MR · XR · US · PT", "MPR & 3D volume", "Window / level presets", "WADO-RS streaming"].map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <ShieldCheck size={12} className="shrink-0 text-pink-200" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
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