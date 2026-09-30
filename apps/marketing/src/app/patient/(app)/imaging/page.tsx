"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  FlaskConical,
  FolderOpen,
  Layers,
  Scan,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  LiveDot,
  PANEL,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  RailRow,
  SECONDARY_BTN,
  Segmented,
  StatTile,
  type Tone,
} from "@/patient/components/workspace";

interface ImagingInstance {
  sopInstanceUid: string;
  fileId: string;
  fileName: string;
  fileSize: number;
}

interface ImagingSeries {
  seriesInstanceUid: string;
  modality: string;
  bodyPart: string;
  seriesDescription?: string;
  instances: ImagingInstance[];
}

interface ImagingStudy {
  studyInstanceUid: string;
  patientId: string;
  studyDate?: string;
  studyDescription?: string;
  series: ImagingSeries[];
  modality?: string;
  bodyPart?: string;
}

const MODALITY_FILTERS = [
  { id: "all", label: "All scans" },
  { id: "xr", label: "X-Ray", codes: ["XR", "CR", "DX"] },
  { id: "mr", label: "MRI", codes: ["MR"] },
  { id: "ct", label: "CT", codes: ["CT"] },
  { id: "us", label: "Ultrasound", codes: ["US"] },
];

function modalityStyle(modality?: string): { label: string; tone: Tone } {
  const m = (modality || "XR").toUpperCase();
  if (m.includes("MR")) return { label: "MRI", tone: "violet" };
  if (m.includes("CT")) return { label: "CT scan", tone: "sky" };
  if (m.includes("US")) return { label: "Ultrasound", tone: "emerald" };
  return { label: "X-Ray", tone: "amber" };
}

function studyModality(study: ImagingStudy) {
  return study.modality || study.series?.[0]?.modality || "XR";
}

const VIEWER_FEATURES = [
  { title: "Window & level", body: "Interactive brightness and contrast across soft tissue, lung, and bone presets." },
  { title: "Stack navigation", body: "Smooth scroll through sequential CT and MRI volumetric slice stacks." },
  { title: "Measurement tools", body: "Caliper measurements, angles, and region-of-interest density inspection." },
  { title: "No installation", body: "Runs client-side in your browser — no plugins or desktop software needed." },
];

export default function PatientImagingPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";

  const [activeModality, setActiveModality] = useState("all");
  const [search, setSearch] = useState("");

  const studiesQ = useQuery({
    queryKey: ["patient", "imaging", "studies", patientId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (patientId) searchParams.set("patientId", patientId);
      const res = await api<{ studies: ImagingStudy[] }>(
        `/imaging/studies?${searchParams.toString()}`,
      );
      return res.studies ?? [];
    },
    enabled: Boolean(patientId),
  });

  const rawStudies = useMemo(() => studiesQ.data ?? [], [studiesQ.data]);

  const modalityCounts = useMemo(() => {
    const counts: Record<string, number> = { xr: 0, mr: 0, ct: 0, us: 0 };
    for (const s of rawStudies) {
      const mod = studyModality(s).toUpperCase();
      if (mod.includes("MR")) counts.mr++;
      else if (mod.includes("CT")) counts.ct++;
      else if (mod.includes("US")) counts.us++;
      else counts.xr++;
    }
    return counts;
  }, [rawStudies]);

  const filteredStudies = useMemo(() => {
    let list = rawStudies;

    if (activeModality !== "all") {
      const filterDef = MODALITY_FILTERS.find((f) => f.id === activeModality);
      if (filterDef?.codes) {
        list = list.filter((s) => {
          const mod = studyModality(s).toUpperCase();
          return filterDef.codes.some((c) => mod.includes(c));
        });
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.studyInstanceUid.toLowerCase().includes(q) ||
          (s.studyDescription || "").toLowerCase().includes(q) ||
          (s.bodyPart || s.series?.[0]?.bodyPart || "").toLowerCase().includes(q) ||
          studyModality(s).toLowerCase().includes(q),
      );
    }

    return list;
  }, [rawStudies, activeModality, search]);

  const loading = profile.isLoading || studiesQ.isLoading;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<ScanLine size={13} aria-hidden />}
          kicker="Records & Labs"
          kickerMeta="Radiology & PACS imaging"
          title={
            <>
              Imaging &amp; <HeroAccent>DICOM scans</HeroAccent>
            </>
          }
          description="Access high-resolution X-rays, MRI, CT scans, and ultrasound studies in a medical-grade web DICOM viewer."
          chips={
            <>
              <span className={HERO_CHIP}>
                <LiveDot tone="sky" />
                {rawStudies.length} stud{rawStudies.length === 1 ? "y" : "ies"} on file
              </span>
              <span className={HERO_CHIP}>
                <Scan size={12} className="text-sky-300" aria-hidden />
                16-bit lossless viewer
              </span>
            </>
          }
          actions={
            <>
              <Link href="/patient/records" className={HERO_GHOST}>
                <FileText size={15} aria-hidden />
                All records
              </Link>
              <Link href="/patient/diagnostic-tests" className={HERO_PRIMARY}>
                <FlaskConical size={15} className="text-sky-600" aria-hidden />
                Book a scan
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="All studies"
            icon={<ScanLine size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(rawStudies.length)}
            sub="Every modality"
            active={activeModality === "all"}
            onClick={() => setActiveModality("all")}
          />
          <StatTile
            label="X-Ray"
            icon={<Scan size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(modalityCounts.xr)}
            sub="XR · CR · DX"
            active={activeModality === "xr"}
            onClick={() => setActiveModality("xr")}
          />
          <StatTile
            label="MRI"
            icon={<Layers size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(modalityCounts.mr)}
            sub="Magnetic resonance"
            active={activeModality === "mr"}
            onClick={() => setActiveModality("mr")}
          />
          <StatTile
            label="CT & ultrasound"
            icon={<Sparkles size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(modalityCounts.ct + modalityCounts.us)}
            sub={`${modalityCounts.ct} CT · ${modalityCounts.us} US`}
            active={activeModality === "ct" || activeModality === "us"}
            onClick={() => setActiveModality("ct")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="im-list">
          <PanelHeader
            id="im-list"
            icon={<ScanLine size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Imaging studies"
            caption={loading ? "Loading…" : `${filteredStudies.length} of ${rawStudies.length} shown`}
            action={
              <Link href="/patient/records" className={SECONDARY_BTN}>
                <FolderOpen size={13} aria-hidden />
                <span className="hidden sm:inline">All records</span>
              </Link>
            }
          />

          <div className="mt-5 flex flex-col gap-3">
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Search by study UID, organ, or modality…"
              ariaLabel="Search imaging studies"
            />
            <Segmented<string>
              ariaLabel="Modality filters"
              value={activeModality}
              onChange={setActiveModality}
              options={MODALITY_FILTERS.map((f) => ({ value: f.id, label: f.label }))}
            />
          </div>

          {loading ? (
            <PanelSkeleton rows={4} />
          ) : filteredStudies.length === 0 ? (
            <EmptyBlock
              icon={<ScanLine size={19} />}
              title={search ? "No scans match your search" : "No imaging studies on file"}
              body={
                search
                  ? `No DICOM studies found for “${search}”. Try clearing search or another modality.`
                  : "When your hospital or radiology centre uploads X-Ray, CT, or MRI scans, they appear here with an interactive web DICOM viewer."
              }
              actions={
                <>
                  {search ? (
                    <button type="button" onClick={() => setSearch("")} className={SECONDARY_BTN}>
                      Clear search
                    </button>
                  ) : null}
                  <Link
                    href="/patient/diagnostic-tests"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <FlaskConical size={13} aria-hidden />
                    Book a diagnostic scan
                  </Link>
                </>
              }
            />
          ) : (
            <div className="mt-5 space-y-2">
              {filteredStudies.map((study) => {
                const badge = modalityStyle(studyModality(study));
                const totalInstances = (study.series || []).reduce(
                  (acc, s) => acc + (s.instances?.length || 0),
                  0,
                );
                const bodyPart = study.bodyPart || study.series?.[0]?.bodyPart || "General anatomy";
                const title = study.studyDescription || `${badge.label} · ${bodyPart}`;

                return (
                  <Link
                    key={study.studyInstanceUid}
                    href={`/patient/imaging/${encodeURIComponent(study.studyInstanceUid)}`}
                    className="block"
                  >
                    <RailRow
                      tone={badge.tone}
                      icon={<ScanLine size={17} />}
                      title={title}
                      meta={[
                        `${study.series?.length || 1} series`,
                        totalInstances > 0 ? `${totalInstances} slices` : null,
                        study.studyDate ? formatDate(study.studyDate) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      trailing={
                        <>
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                          <span className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors group-hover:bg-sky-50">
                            Viewer
                            <ChevronRight size={13} aria-hidden />
                          </span>
                        </>
                      }
                    >
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-400">
                        UID {study.studyInstanceUid.slice(0, 32)}
                        {study.studyInstanceUid.length > 32 ? "…" : ""}
                      </span>
                    </RailRow>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Viewer capabilities">
          <section className={PANEL} aria-labelledby="im-caps">
            <PanelHeader
              id="im-caps"
              icon={<SlidersHorizontal size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="DICOM viewer capabilities"
              caption="Medical-grade tools, zero install"
            />
            <div className="mt-4 flex flex-col gap-2">
              {VIEWER_FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl bg-slate-50 p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]"
                >
                  <p className="text-xs font-semibold text-slate-800">{f.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{f.body}</p>
                </div>
              ))}
            </div>
          </section>

          <QuickToolsPanel
            id="im-tools"
            tools={[
              { href: "/patient/diagnostic-tests", label: "Book a scan", hint: "Diagnostics", icon: FlaskConical, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/records", label: "Records", hint: "Full file", icon: FolderOpen, tone: "from-slate-600 to-slate-800 shadow-slate-500/30" },
              { href: "/patient/timeline", label: "Timeline", hint: "In context", icon: CalendarDays, tone: "from-teal-500 to-emerald-600 shadow-teal-500/30" },
            ]}
          />

          <PromoCard
            href="/patient/ai"
            kicker="AI assistant"
            icon={<Sparkles size={21} aria-hidden />}
            title="Understand a scan report"
            body="Ask questions about findings in plain language"
          />
        </aside>
      </div>
    </PatientPage>
  );
}
