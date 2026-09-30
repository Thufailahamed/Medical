"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Plus,
  ScanLine,
  ShieldCheck,
  Syringe,
} from "lucide-react";

import { VaccinationFormSheet } from "@/patient/components/vaccinations/VaccinationFormSheet";
import {
  useAddVaccination,
  useVaccinations,
  useVaccinationsDue,
} from "@/patient/hooks";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  GROUP_LABEL,
  HERO_ATTENTION_CHIP,
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
  PromoCard,
  QuickToolsPanel,
  RailRow,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

type Tab = "all" | "administered" | "due";

const DUE_STYLE: Record<string, { tone: "rose" | "amber" | "sky"; icon: typeof Clock3; label: string }> = {
  overdue: { tone: "rose", icon: AlertTriangle, label: "Overdue" },
  upcoming: { tone: "sky", icon: CalendarDays, label: "Upcoming" },
};

export default function VaccinationsPage() {
  const administered = useVaccinations();
  const due = useVaccinationsDue();
  const add = useAddVaccination();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const administeredList = useMemo(
    () => administered.data?.administered ?? [],
    [administered.data],
  );
  const dueSlots = useMemo(() => due.data?.due ?? [], [due.data]);
  const overdueSlots = useMemo(() => due.data?.overdue ?? [], [due.data]);
  const upcomingSlots = useMemo(() => due.data?.upcoming ?? [], [due.data]);
  const allDue = useMemo(
    () => [...overdueSlots, ...dueSlots, ...upcomingSlots],
    [overdueSlots, dueSlots, upcomingSlots],
  );

  const totalAdministered = administeredList.length;
  const totalDue = overdueSlots.length + dueSlots.length;
  const totalUpcoming = upcomingSlots.length;

  const filteredAdministered = useMemo(() => {
    if (activeTab === "due") return [];
    let list = administeredList;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.vaccineName.toLowerCase().includes(q) ||
          (v.provider || "").toLowerCase().includes(q) ||
          (v.notes || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [administeredList, activeTab, search]);

  const filteredDue = useMemo(() => {
    if (activeTab === "administered") return [];
    let list = allDue;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => v.vaccineName.toLowerCase().includes(q));
    }
    return list;
  }, [allDue, activeTab, search]);

  const loading = administered.isLoading || due.isLoading;
  const nothingShown =
    !loading && filteredAdministered.length === 0 && filteredDue.length === 0;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<Syringe size={13} aria-hidden />}
          kicker="Records & Labs"
          kickerMeta="WHO immunisation schedule"
          title={
            <>
              Vaccinations &amp; <HeroAccent>immunisation</HeroAccent>
            </>
          }
          description="Log administered immunisations, track booster timelines, and monitor WHO/EPI schedule compliance."
          chips={
            <>
              {totalDue > 0 ? (
                <span className={HERO_ATTENTION_CHIP}>
                  <Clock3 size={12} aria-hidden />
                  {totalDue} dose{totalDue === 1 ? "" : "s"} due or overdue
                </span>
              ) : (
                <span className={HERO_CHIP}>
                  <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                  Up to date
                </span>
              )}
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-sky-300" aria-hidden />
                EPI schedule compliant
              </span>
            </>
          }
          actions={
            <>
              <Link href="/patient/ai/vaccination-card" className={HERO_GHOST}>
                <Camera size={15} aria-hidden />
                Scan card
              </Link>
              <button type="button" onClick={() => setOpen(true)} className={HERO_PRIMARY}>
                <Plus size={15} className="text-sky-600" aria-hidden />
                Record vaccine
              </button>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Administered"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(totalAdministered)}
            sub="Doses on record"
            active={activeTab === "administered"}
            onClick={() => setActiveTab("administered")}
          />
          <StatTile
            label="Due or overdue"
            icon={<Clock3 size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(totalDue)}
            sub={totalDue ? "Needs a booking" : "Nothing pending"}
            pulse={totalDue > 0}
            badge={totalDue > 0 ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={activeTab === "due"}
            onClick={() => setActiveTab("due")}
          />
          <StatTile
            label="Upcoming"
            icon={<CalendarDays size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(totalUpcoming)}
            sub="Scheduled ahead"
            onClick={() => setActiveTab("due")}
          />
          <StatTile
            label="Total tracked"
            icon={<Syringe size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(totalAdministered + allDue.length)}
            sub="Across all statuses"
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="vx-list">
          <PanelHeader
            id="vx-list"
            icon={<Syringe size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            title="Immunisation record"
            caption={
              loading
                ? "Loading…"
                : `${filteredAdministered.length + filteredDue.length} shown · ${totalAdministered} administered`
            }
            action={
              <button type="button" onClick={() => setOpen(true)} className={SECONDARY_BTN}>
                <Plus size={13} aria-hidden />
                <span className="hidden sm:inline">Record vaccine</span>
              </button>
            }
          />

          <div className="mt-5 flex flex-col gap-3">
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Search vaccine, disease, or provider…"
              ariaLabel="Search vaccinations"
            />
            <Segmented<Tab>
              ariaLabel="Vaccination filters"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: "all", label: "All", count: totalAdministered + allDue.length },
                { value: "administered", label: "Administered", count: totalAdministered },
                { value: "due", label: "Due / upcoming", count: allDue.length },
              ]}
            />
          </div>

          {loading ? (
            <PanelSkeleton rows={4} />
          ) : nothingShown ? (
            <EmptyBlock
              icon={<Syringe size={19} />}
              title={search ? "No vaccinations match your search" : "No vaccinations recorded"}
              body={
                search
                  ? `Nothing found for “${search}” — clear the search or pick another filter.`
                  : "Log childhood immunisations, travel shots, or COVID-19 boosters for your personal medical record."
              }
              actions={
                search ? (
                  <button type="button" onClick={() => setSearch("")} className={SECONDARY_BTN}>
                    Clear search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <Plus size={13} aria-hidden />
                    Add first vaccine
                  </button>
                )
              }
            />
          ) : (
            <div className="mt-5 flex flex-col gap-6">
              {filteredAdministered.length ? (
                <div>
                  <p className={GROUP_LABEL}>Administered · {filteredAdministered.length}</p>
                  <div className="mt-2.5 space-y-2">
                    {filteredAdministered.map((v) => (
                      <RailRow
                        key={v.id}
                        tone="emerald"
                        icon={<CheckCircle2 size={17} />}
                        title={v.vaccineName}
                        meta={[v.dose, formatDate(v.administeredAt), v.provider].filter(Boolean).join(" · ")}
                        trailing={<Badge tone="emerald">Administered</Badge>}
                      >
                        {v.notes ? (
                          <span className="mt-0.5 block truncate text-[11px] text-slate-400">{v.notes}</span>
                        ) : null}
                      </RailRow>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab !== "administered" ? (
                <div>
                  <p className={GROUP_LABEL}>Due &amp; upcoming · {filteredDue.length}</p>
                  {filteredDue.length ? (
                    <div className="mt-2.5 space-y-2">
                      {filteredDue.map((slot) => {
                        const s = DUE_STYLE[slot.status] ?? { tone: "amber" as const, icon: Clock3, label: "Due" };
                        const Icon = s.icon;
                        return (
                          <RailRow
                            key={slot.id}
                            tone={s.tone}
                            icon={<Icon size={17} />}
                            title={slot.vaccineName}
                            meta={[
                              slot.doseNumber ? `Dose #${slot.doseNumber}` : null,
                              `Due ${formatDate(slot.dueAt)}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            trailing={<Badge tone={s.tone}>{s.label}</Badge>}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2.5 flex items-center gap-3 rounded-xl bg-slate-50 p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-emerald-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]" aria-hidden>
                        <CheckCircle2 size={15} />
                      </span>
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">Nothing due right now</span>
                        <span className="block text-[11px] text-slate-400">You&rsquo;re up to date on standard boosters.</span>
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Vaccination tools">
          <QuickToolsPanel
            id="vx-tools"
            tools={[
              { href: "/patient/ai/vaccination-card", label: "Scan card", hint: "AI card reader", icon: Camera, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { href: "/patient/records", label: "Records", hint: "Full file", icon: FolderOpen, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/imaging", label: "Imaging", hint: "Scans & DICOM", icon: ScanLine, tone: "from-slate-600 to-slate-800 shadow-slate-500/30" },
              { href: "/patient/timeline", label: "Timeline", hint: "In context", icon: CalendarDays, tone: "from-teal-500 to-emerald-600 shadow-teal-500/30" },
            ]}
          />
          <PromoCard
            href="/patient/ai/vaccination-card"
            kicker="AI card scanner"
            icon={<Camera size={21} aria-hidden />}
            title="Have a physical vaccination card?"
            body="Take a photo — the assistant extracts doses and batch numbers"
          />
        </aside>
      </div>

      <VaccinationFormSheet
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </PatientPage>
  );
}
