"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Pill,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { usePrescriptions } from "@/patient/hooks/prescriptions";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { patientPaths } from "@healthcare/shared/contracts";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PrimaryLink,
  ROW_LINK,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

function cleanScheduleString(val: string | null | undefined): string {
  if (!val) return "";
  const cleaned = val.replace(/_/g, " ").trim();
  const lower = cleaned.toLowerCase();
  if (lower === "three times daily") return "3 times daily";
  if (lower === "twice daily") return "2 times daily";
  if (lower === "once daily") return "Once daily";
  if (lower === "as needed") return "As needed";
  if (lower === "after food") return "After meals";
  if (lower === "before food") return "Before meals";
  return humanize(cleaned);
}

type Tab = "all" | "active" | "past";

export default function PrescriptionsPage() {
  const query = usePrescriptions();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const rawPrescriptions = query.data?.prescriptions ?? [];

  const { activeList, pastList, totalMedicines, topMeds, doctors } = useMemo(() => {
    const active = rawPrescriptions.filter((p) => p.status === "active" || p.status === "draft");
    const past = rawPrescriptions.filter((p) => p.status !== "active" && p.status !== "draft");
    const medCount = rawPrescriptions.reduce((acc, p) => acc + (p.medicineCount || p.medicines?.length || 0), 0);
    const medTally = new Map<string, number>();
    const docTally = new Map<string, { name: string; spec: string | null; count: number }>();
    for (const p of rawPrescriptions) {
      for (const m of p.medicines ?? []) medTally.set(m.name, (medTally.get(m.name) ?? 0) + 1);
      if (p.doctorName) {
        const cur = docTally.get(p.doctorName) ?? { name: p.doctorName, spec: p.doctorSpecialization ?? null, count: 0 };
        cur.count += 1;
        docTally.set(p.doctorName, cur);
      }
    }
    return {
      activeList: active,
      pastList: past,
      totalMedicines: medCount,
      topMeds: [...medTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      doctors: [...docTally.values()].sort((a, b) => b.count - a.count),
    };
  }, [rawPrescriptions]);

  const filteredPrescriptions = useMemo(() => {
    let list = rawPrescriptions;
    if (activeTab === "active") list = activeList;
    if (activeTab === "past") list = pastList;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.diagnosis || "").toLowerCase().includes(q) ||
          (p.doctorName || "").toLowerCase().includes(q) ||
          (p.doctorSpecialization || "").toLowerCase().includes(q) ||
          p.medicines?.some((m) => m.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [rawPrescriptions, activeTab, activeList, pastList, search]);

  async function downloadPdf(id: string) {
    setDownloading(id);
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
      setDownloading(null);
    }
  }

  const latest = rawPrescriptions[0] ?? null;
  const maxMed = topMeds[0]?.[1] ?? 1;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<ShieldCheck size={13} aria-hidden />}
          kicker="Prescriptions"
          kickerMeta={`${rawPrescriptions.length} on file`}
          title={
            <>
              Signed <HeroAccent>prescriptions</HeroAccent>
            </>
          }
          description={
            latest
              ? `Latest from ${latest.doctorName ?? "your doctor"} on ${formatDayLabel(latest.date)}. Download the official PDF for any pharmacy.`
              : "Every prescription your doctors sign lands here — with dosage guidance and an official PDF."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <BadgeCheck size={12} className="text-emerald-300" aria-hidden />
                Digitally signed by your doctor
              </span>
              {activeList.length > 0 ? (
                <span className={HERO_CHIP}>
                  <Pill size={12} className="text-sky-300" aria-hidden />
                  {activeList.length} active course{activeList.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <Link href="/patient/appointments/book" className={HERO_GHOST}>
                <Stethoscope size={15} aria-hidden />
                See a doctor
              </Link>
              <Link href="/patient/medications" className={HERO_PRIMARY}>
                <Pill size={15} className="text-sky-600" aria-hidden />
                Dose schedule
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="All prescriptions"
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={query.isLoading ? "…" : String(rawPrescriptions.length)}
            sub={latest ? `Latest ${formatDayLabel(latest.date)}` : "None yet"}
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          />
          <StatTile
            label="Active"
            icon={<BadgeCheck size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(activeList.length)}
            sub="Current treatment"
            active={activeTab === "active"}
            onClick={() => setActiveTab(activeTab === "active" ? "all" : "active")}
          />
          <StatTile
            label="History"
            icon={<Archive size={16} />}
            tone="bg-slate-100 text-slate-500"
            value={String(pastList.length)}
            sub="Completed or expired"
            active={activeTab === "past"}
            onClick={() => setActiveTab(activeTab === "past" ? "all" : "past")}
          />
          <StatTile
            label="Medicines prescribed"
            icon={<Pill size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(totalMedicines)}
            sub={`${topMeds.length} unique`}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="rx-list">
          <PanelHeader
            id="rx-list"
            icon={<FileText size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={activeTab === "active" ? "Active prescriptions" : activeTab === "past" ? "Prescription history" : "All prescriptions"}
            caption={query.isLoading ? "Loading…" : `${filteredPrescriptions.length} of ${rawPrescriptions.length} shown`}
            action={
              activeTab !== "all" || search ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("all");
                    setSearch("");
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <RotateCcw size={12} aria-hidden />
                  Reset
                </button>
              ) : null
            }
          />
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PanelSearch value={search} onChange={setSearch} placeholder="Search diagnosis, doctor or medicine…" ariaLabel="Search prescriptions" />
            <Segmented<Tab>
              ariaLabel="Prescription filters"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: "all", label: "All", count: rawPrescriptions.length },
                { value: "active", label: "Active", count: activeList.length },
                { value: "past", label: "History", count: pastList.length },
              ]}
            />
          </div>

          {query.isLoading ? (
            <PanelSkeleton rows={3} />
          ) : filteredPrescriptions.length === 0 ? (
            <EmptyBlock
              icon={<FileText size={19} />}
              title="No prescriptions found"
              body={
                search
                  ? `No prescriptions match "${search}". Try another keyword.`
                  : "When your doctor prescribes medicines, the signed script appears here."
              }
              actions={
                <PrimaryLink href="/patient/appointments/book" icon={<Stethoscope size={13} />}>
                  Book a consultation
                </PrimaryLink>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {filteredPrescriptions.map((rx) => {
                const isDownloading = downloading === rx.id;
                const isSigned = rx.status === "active" || Boolean(rx.signedAt);
                const isActive = rx.status === "active" || rx.status === "draft";
                const count = rx.medicineCount || rx.medicines?.length || 0;
                return (
                  <li
                    key={rx.id}
                    className={cn(
                      "group relative flex flex-col gap-3 rounded-xl p-4 transition-all",
                      isActive
                        ? "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                        : "bg-slate-50/70 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]",
                    )}
                  >
                    <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", isActive ? "bg-emerald-500" : "bg-slate-300")} aria-hidden />
                    <div className="flex items-start gap-3.5">
                      <span
                        className={cn(
                          "ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                          isActive ? "bg-sky-50 text-sky-600" : "bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
                        )}
                        aria-hidden
                      >
                        <FileText size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/patient/prescriptions/${rx.id}`}
                            className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700"
                          >
                            {rx.diagnosis || "Prescription"}
                          </Link>
                          <Badge tone={isSigned ? "emerald" : "slate"}>
                            {isSigned ? <BadgeCheck size={11} aria-hidden /> : null}
                            {isSigned ? "Signed" : humanize(rx.status)}
                          </Badge>
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-400">
                          {rx.doctorName ? (
                            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                              <Stethoscope size={12} aria-hidden />
                              {rx.doctorName}
                              {rx.doctorSpecialization ? <span className="font-normal text-slate-400"> · {rx.doctorSpecialization}</span> : null}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays size={12} aria-hidden />
                            {formatDayLabel(rx.date)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Pill size={12} aria-hidden />
                            {count} medicine{count === 1 ? "" : "s"}
                          </span>
                        </p>
                      </div>
                      <Link
                        href={`/patient/prescriptions/${rx.id}`}
                        aria-label="Open prescription"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-sky-50 hover:text-sky-600"
                      >
                        <ChevronRight size={16} aria-hidden />
                      </Link>
                    </div>

                    {rx.medicines && rx.medicines.length > 0 ? (
                      <div className="ml-1 grid grid-cols-1 gap-1.5 sm:ml-[3.4rem] md:grid-cols-2">
                        {rx.medicines.map((med) => {
                          const freq = cleanScheduleString(med.frequency);
                          const timing = cleanScheduleString(med.timing);
                          return (
                            <div key={med.id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
                              <Pill size={13} className="shrink-0 text-emerald-500" aria-hidden />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-xs font-semibold text-slate-800">{med.name}</span>
                                  <span className="shrink-0 text-[11px] font-semibold text-sky-700">{med.dosage}</span>
                                </span>
                                {freq || timing ? (
                                  <span className="block truncate text-[11px] text-slate-400">{[freq, timing].filter(Boolean).join(" · ")}</span>
                                ) : null}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {rx.notes ? (
                      <p className="ml-1 rounded-lg bg-sky-50/70 px-3 py-2 text-xs text-slate-600 sm:ml-[3.4rem]">
                        <span className="font-semibold text-sky-800">Doctor&apos;s advice: </span>
                        {rx.notes}
                      </p>
                    ) : null}

                    <div className="ml-1 flex flex-wrap items-center gap-1.5 sm:ml-[3.4rem]">
                      <button
                        type="button"
                        onClick={() => downloadPdf(rx.id)}
                        disabled={isDownloading}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700 disabled:opacity-60"
                      >
                        {isDownloading ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Download size={13} aria-hidden />}
                        {isDownloading ? "Preparing PDF…" : "PDF"}
                      </button>
                      <Link href={`/patient/prescriptions/${rx.id}`} className={ROW_LINK}>
                        Details
                        <ChevronRight size={13} aria-hidden />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Prescription insights">
          <section className={PANEL} aria-labelledby="rx-top">
            <PanelHeader
              id="rx-top"
              icon={<Pill size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Most prescribed"
              caption={topMeds.length ? `${topMeds.length} medicines` : "Nothing yet"}
            />
            {topMeds.length === 0 ? (
              <EmptyBlock icon={<Pill size={19} />} title="No medicines yet" body="Medicines from your prescriptions are tallied here." />
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {topMeds.map(([name, n]) => (
                  <li key={name}>
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate font-medium text-slate-700">{name}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-slate-500">{n}×</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400" style={{ width: `${(n / maxMed) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={PANEL} aria-labelledby="rx-docs">
            <PanelHeader
              id="rx-docs"
              icon={<UserRound size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Prescribing doctors"
              caption={`${doctors.length} doctor${doctors.length === 1 ? "" : "s"}`}
              href="/patient/care-team"
              linkLabel="Care team"
            />
            {doctors.length === 0 ? (
              <EmptyBlock icon={<UserRound size={19} />} title="No doctors yet" body="Doctors who prescribe for you appear here." />
            ) : (
              <ul className="mt-4 flex flex-col gap-0.5">
                {doctors.slice(0, 6).map((d) => (
                  <li key={d.name} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-xs font-semibold text-white" aria-hidden>
                      {d.name.replace(/^Dr\.?\s*/i, "")[0]?.toUpperCase() ?? "D"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-800">{d.name}</span>
                      {d.spec ? <span className="block truncate text-[11px] text-slate-400">{d.spec}</span> : null}
                    </span>
                    <span className="min-w-[28px] rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-700">{d.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </PatientPage>
  );
}
