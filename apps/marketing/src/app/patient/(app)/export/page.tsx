"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  Download,
  FileCode2,
  FileLock2,
  FileText,
  Hospital,
  Layers,
  Loader2,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Syringe,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import {
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";

const FORMATS = [
  {
    id: "fhir-bundle" as const,
    label: "HL7 FHIR R4 Bundle",
    badge: "Hospital Standard",
    badgeTone: "bg-sky-50 text-sky-700",
    desc: "Global interoperability format accepted by Epic, Cerner, Apple Health, and international hospitals.",
    icon: Hospital,
    ext: "json",
  },
  {
    id: "json" as const,
    label: "Full JSON Archive",
    badge: "Complete Dataset",
    badgeTone: "bg-emerald-50 text-emerald-700",
    desc: "Comprehensive machine-readable dump including vitals, lab reports, prescriptions, notes, and audits.",
    icon: FileCode2,
    ext: "json",
  },
  {
    id: "txt" as const,
    label: "Clinical Summary Text",
    badge: "Human-Readable",
    badgeTone: "bg-violet-50 text-violet-700",
    desc: "Formatted plain-text medical summary ideal for physical printing, offline viewing, or simple sharing.",
    icon: FileText,
    ext: "txt",
  },
];

type ExportFormat = (typeof FORMATS)[number]["id"];

const INCLUDED_CATEGORIES = [
  { label: "Doctor Consultations", desc: "Visit summaries & clinical encounter notes", icon: Stethoscope },
  { label: "Lab Diagnostic Tests", desc: "Pathology results, blood panels & reference ranges", icon: Activity },
  { label: "Prescriptions & Medications", desc: "Active & past medications, dosages, and refills", icon: Pill },
  { label: "Immunization History", desc: "Vaccination batch records & EPI schedules", icon: Syringe },
  { label: "Allergies & Contraindications", desc: "Adverse drug reactions & severe food allergies", icon: ShieldAlert },
  { label: "Insurance Claims & Policies", desc: "Active coverage, policy numbers & reimbursement audits", icon: ShieldCheck },
];

export default function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>("fhir-bundle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  async function download() {
    setLoading(true);
    setError(null);
    setDownloadSuccess(false);
    try {
      const payload = await api<string>(`/export/me?format=${format}`);
      const selected = FORMATS.find((f) => f.id === format);
      const isTxt = format === "txt";
      const blob = new Blob([typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)], {
        type: isTxt ? "text/plain" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `healthhub-export-${new Date().toISOString().slice(0, 10)}.${selected?.ext || "json"}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create your export archive.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedFormatObj = FORMATS.find((f) => f.id === format) ?? FORMATS[0];

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<Archive size={13} aria-hidden />}
        kicker="Tools"
        kickerMeta="Data portability"
        title={
          <>
            Export your <HeroAccent>health records</HeroAccent>
          </>
        }
        description="Download a complete, un-truncated copy of your medical records — compatible with hospital EHR networks, overseas physicians, and personal backup drives."
        chips={
          <>
            <span className={HERO_CHIP}>
              <Hospital size={12} className="text-sky-300" />
              HL7 FHIR R4
            </span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              GDPR Article 20
            </span>
            <span className={HERO_CHIP}>AES-256 GCM</span>
          </>
        }
        actions={
          <>
            <Link href="/patient/audit" className={HERO_GHOST}>
              <Clock size={13} /> Activity audit
            </Link>
            <Link href="/patient/dsar" className={HERO_PRIMARY}>
              <FileLock2 size={14} className="text-sky-600" /> Data requests
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Layers size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Categories"
          value={String(INCLUDED_CATEGORIES.length)}
          sub="Record domains included"
        />
        <StatTile
          icon={<Hospital size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Formats"
          value={String(FORMATS.length)}
          sub="FHIR · JSON · TXT"
        />
        <StatTile
          icon={<ShieldCheck size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Completeness"
          value="100%"
          sub="Full EHR, no truncation"
        />
        <StatTile
          icon={<FileLock2 size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Data rights"
          value="DSAR"
          sub="Erasure & rectification"
          href="/patient/dsar"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<Archive size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Choose export format"
              caption="Pick the structure that fits where the archive is going."
            />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {FORMATS.map((f) => {
                const Icon = f.icon;
                const isSelected = format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex cursor-pointer flex-col justify-between gap-4 rounded-2xl border p-5 text-left transition-all",
                      isSelected
                        ? "border-sky-300 bg-sky-50/60 shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-md",
                    )}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div
                          className={cn(
                            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                            isSelected
                              ? "bg-[#07233a] text-white"
                              : "bg-slate-100 text-slate-500",
                          )}
                          aria-hidden
                        >
                          <Icon size={18} />
                        </div>
                        <span
                          className={cn(
                            "rounded-md px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            f.badgeTone,
                          )}
                        >
                          {f.badge}
                        </span>
                      </div>
                      <h3 className="mt-1 text-sm font-bold text-slate-900">{f.label}</h3>
                      <p className="text-xs font-medium leading-relaxed text-slate-500">
                        {f.desc}
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="font-mono font-bold uppercase text-slate-400">
                        .{f.ext}
                      </span>
                      {isSelected ? (
                        <span className="flex items-center gap-1 font-bold text-sky-700">
                          <CheckCircle2 size={13} aria-hidden />
                          Selected
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-400">Select</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Download trigger */}
            <div className="mt-4 flex flex-col items-center justify-between gap-5 rounded-2xl border border-sky-100 bg-sky-50/50 p-6 sm:flex-row">
              <div className="flex items-center gap-4">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#07233a] text-white shadow-md"
                  aria-hidden
                >
                  <Download size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Ready to download: {selectedFormatObj.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Downloaded over encrypted HTTPS directly to your device storage.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={download}
                disabled={loading}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    Generating archive…
                  </>
                ) : (
                  <>
                    <Download size={16} aria-hidden />
                    Download (.{selectedFormatObj.ext})
                  </>
                )}
              </button>
            </div>

            {error ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                <AlertCircle size={18} className="shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}

            {downloadSuccess ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-700">
                <CheckCircle2 size={18} className="shrink-0" aria-hidden />
                <span>
                  Your medical record archive has been prepared and downloaded to your computer.
                </span>
              </div>
            ) : null}
          </section>

          <section className={PANEL}>
            <PanelHeader
              icon={<Layers size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="What's inside your export"
              caption="Every record on HealthHub is compiled in full — no truncation."
            />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {INCLUDED_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.label}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                  >
                    <div
                      className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-sky-600 shadow-sm"
                      aria-hidden
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">{cat.label}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                        {cat.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<FileLock2 size={16} />}
              tone="bg-amber-50 text-amber-600"
              title="Formal privacy requests"
              caption="Erasure or rectification."
            />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Submit a Data Subject Access Request (DSAR) to rectify erroneous lab
              results or request permanent file erasure under applicable
              regulations.
            </p>
            <Link
              href="/patient/dsar"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <FileLock2 size={13} /> Data subject requests
            </Link>
          </section>

          <QuickToolsPanel
            id="export-tools"
            title="Tools"
            tools={[
              {
                icon: FileText,
                label: "Records",
                hint: "Documents",
                href: "/patient/records",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: Clock,
                label: "Audit",
                hint: "Activity",
                href: "/patient/audit",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
              {
                icon: ShieldCheck,
                label: "Consents",
                hint: "Grants",
                href: "/patient/consents",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}
