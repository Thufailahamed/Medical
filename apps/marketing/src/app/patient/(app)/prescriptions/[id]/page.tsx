"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  Clock,
  Download,
  FileText,
  Loader2,
  Pill,
  ShieldCheck,
  Stethoscope,
  Utensils,
} from "lucide-react";

import { usePrescription } from "@/patient/hooks/prescriptions";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { patientPaths } from "@healthcare/shared/contracts";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroTile,
  InfoField,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

type RxMedicine = {
  id: string;
  name: string;
  dosage: string;
  frequency: string | null;
  timing: string | null;
  startDate: string | null;
  endDate: string | null;
  instructions: string | null;
};

export default function PrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = usePrescription(id);
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const url = patientPaths.prescriptions.pdf(id);
      const token = typeof window !== "undefined" ? window.localStorage.getItem("auth-token") : null;
      if (token) {
        const fullUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}${url}`;
        const response = await fetch(fullUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const blob = await response.blob();
          window.open(URL.createObjectURL(blob), "_blank");
        }
      }
    } catch (err) {
      console.error("Failed to download PDF", err);
    } finally {
      setDownloading(false);
    }
  }

  const rx = query.data?.prescription ?? null;

  if (!rx) {
    return (
      <PatientPage>
        <PatientHero
          overlap={false}
          kickerIcon={<FileText size={13} aria-hidden />}
          kicker="Prescription"
          title={query.isLoading ? "Loading prescription…" : "Prescription not found"}
          description={query.isLoading ? "Fetching the signed script." : "It may have been removed or isn't available to you."}
          actions={
            <Link href="/patient/prescriptions" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All prescriptions
            </Link>
          }
        />
        <section className={PANEL}>
          {query.isLoading ? (
            <PanelSkeleton rows={3} className="mt-0" />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : (
            <EmptyBlock className="mt-0" icon={<FileText size={19} />} title="Nothing to show" body="Head back to pick another prescription." />
          )}
        </section>
      </PatientPage>
    );
  }

  const medicines = (rx.medicines ?? []) as RxMedicine[];
  const isActive = rx.status === "active";

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        leading={
          <HeroTile tone="from-emerald-400 to-teal-600">
            <FileText size={30} aria-hidden />
          </HeroTile>
        }
        kickerIcon={<ShieldCheck size={13} aria-hidden />}
        kicker="Prescription"
        kickerMeta={formatDayLabel(rx.date)}
        title={rx.diagnosis || "Prescription details"}
        description={`Issued by ${rx.doctorName ?? "your doctor"}${rx.doctorSpecialization ? ` · ${rx.doctorSpecialization}` : ""}`}
        chips={
          <>
            <span className={HERO_CHIP}>
              <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-emerald-400" : "bg-slate-400")} aria-hidden />
              {humanize(rx.status)}
            </span>
            {rx.signedAt ? (
              <span className={HERO_CHIP}>
                <BadgeCheck size={12} className="text-emerald-300" aria-hidden />
                Signed {formatDayLabel(rx.signedAt)}
              </span>
            ) : null}
            <span className={HERO_CHIP}>
              <Pill size={12} className="text-sky-300" aria-hidden />
              {medicines.length} medicine{medicines.length === 1 ? "" : "s"}
            </span>
          </>
        }
        actions={
          <>
            <Link href="/patient/prescriptions" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All
            </Link>
            <button type="button" onClick={downloadPdf} disabled={downloading} className={HERO_PRIMARY}>
              {downloading ? <Loader2 size={15} className="animate-spin text-sky-600" aria-hidden /> : <Download size={15} className="text-sky-600" aria-hidden />}
              {downloading ? "Preparing…" : "Download PDF"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <section className={PANEL} aria-labelledby="rxd-meds">
            <PanelHeader
              id="rxd-meds"
              icon={<Pill size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Medicines"
              caption={`${medicines.length} item${medicines.length === 1 ? "" : "s"} on this script`}
            />
            {medicines.length === 0 ? (
              <EmptyBlock icon={<Pill size={19} />} title="No medicines attached" body="This prescription doesn't list any medicines." />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {medicines.map((med, i) => (
                  <li key={med.id} className="relative rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
                    <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-emerald-500" aria-hidden />
                    <div className="flex items-start gap-3.5">
                      <span className="ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-sm font-bold text-emerald-700 tabular-nums" aria-hidden>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-semibold text-slate-900">{med.name}</h3>
                          <Badge tone="sky">{med.dosage}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {med.frequency ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                              <Clock size={11} aria-hidden />
                              {humanize(med.frequency)}
                            </span>
                          ) : null}
                          {med.timing ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                              <Utensils size={11} aria-hidden />
                              {humanize(med.timing)}
                            </span>
                          ) : null}
                          {med.startDate ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                              <CalendarDays size={11} aria-hidden />
                              {formatDayLabel(med.startDate)}
                              {med.endDate ? ` → ${formatDayLabel(med.endDate)}` : ""}
                            </span>
                          ) : null}
                        </div>
                        {med.instructions ? (
                          <p className="mt-2 rounded-lg bg-sky-50/70 px-3 py-2 text-xs text-slate-700">
                            <span className="font-semibold text-sky-800">Instructions: </span>
                            {med.instructions}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={PANEL} aria-labelledby="rxd-info">
            <PanelHeader id="rxd-info" icon={<FileText size={16} />} tone="bg-sky-50 text-sky-600" title="Prescription details" caption="As issued by your doctor" />
            <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoField icon={<CalendarDays size={14} />} label="Issued on">
                {formatDayLabel(rx.date)}
              </InfoField>
              <InfoField icon={<Stethoscope size={14} />} label="Doctor">
                {rx.doctorName ? `${rx.doctorName}${rx.doctorSpecialization ? ` · ${rx.doctorSpecialization}` : ""}` : "—"}
              </InfoField>
              <InfoField icon={<BadgeCheck size={14} />} label="Signed at">
                {rx.signedAt ? formatDayLabel(rx.signedAt) : "Not signed yet"}
              </InfoField>
              <InfoField icon={<Pill size={14} />} label="Medicines">
                {rx.medicineCount} item{rx.medicineCount === 1 ? "" : "s"}
              </InfoField>
            </dl>
            {rx.notes ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
                <p className="text-[11px] font-medium text-slate-400">Doctor&apos;s notes</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{rx.notes}</p>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Prescription actions">
          <section className={PANEL} aria-labelledby="rxd-plan">
            <PanelHeader id="rxd-plan" icon={<Pill size={16} />} tone="bg-emerald-50 text-emerald-600" title="Add to your plan" caption="Schedule reminders & track doses" />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Signed medicines show up in Medications with reminders so you can log each dose.
            </p>
            <Link
              href="/patient/medications"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#07233a] text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700"
            >
              <Pill size={14} aria-hidden />
              Open medications
            </Link>
          </section>

          <section className={PANEL} aria-labelledby="rxd-verify">
            <PanelHeader id="rxd-verify" icon={<ShieldCheck size={16} />} tone="bg-sky-50 text-sky-600" title="Verifiable record" caption="Any pharmacy can check it" />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Every prescription carries a unique signature a pharmacy can verify before dispensing.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href={`/portal/verify/${rx.id}`} className={cn(SECONDARY_BTN, "h-10 justify-center")}>
                <ShieldCheck size={14} aria-hidden />
                Verify prescription
              </Link>
              <button type="button" onClick={downloadPdf} disabled={downloading} className={cn(SECONDARY_BTN, "h-10 justify-center")}>
                <Download size={14} aria-hidden />
                Download PDF
              </button>
            </div>
          </section>
        </aside>
      </div>
    </PatientPage>
  );
}
