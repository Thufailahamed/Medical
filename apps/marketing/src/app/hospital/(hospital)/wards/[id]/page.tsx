"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BedDouble,
  CheckCircle2,
  Hospital,
  Plus,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PRIMARY_BTN,
  SECONDARY_BTN,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_INPUT,
  HeroPulse,
  QuickToolsPanel,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type Bed = {
  id: string;
  bedNumber?: string;
  status?: string;
};

const BED_STYLE: Record<string, { tile: string; dot: string }> = {
  available: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  occupied: { tile: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  cleaning: { tile: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-400" },
  maintenance: { tile: "bg-slate-100 text-slate-500 ring-slate-200", dot: "bg-slate-400" },
};

export default function WardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useT();
  const { id } = use(params);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bedNumber: "" });

  const beds = useQuery({
    queryKey: ["beds", id],
    queryFn: () => api<{ beds: Bed[] }>(`/hospital-portal/beds?wardId=${id}`),
    refetchInterval: 30_000,
  });

  const createBed = useMutation({
    mutationFn: (body: { wardId: string; bedNumber: string }) =>
      api("/hospital-portal/beds", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beds", id] });
      setOpen(false);
      setForm({ bedNumber: "" });
      toast.success("Bed added");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const setStatus = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      api(`/hospital-portal/beds/${bedId}/status`, {
        method: "PUT",
        json: { status },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beds", id] }),
  });

  const list = useMemo(() => beds.data?.beds ?? [], [beds.data]);
  const counts = useMemo(
    () => ({
      total: list.length,
      available: list.filter((b) => b.status === "available").length,
      occupied: list.filter((b) => b.status === "occupied").length,
      cleaning: list.filter((b) => b.status === "cleaning").length,
      maintenance: list.filter((b) => b.status === "maintenance").length,
    }),
    [list],
  );
  const occupancyRate = counts.total > 0 ? Math.round((counts.occupied / counts.total) * 100) : 0;

  const hero = (
    <DoctorHero
      kickerIcon={<Hospital size={13} aria-hidden />}
      kicker={t("nav.wards")}
      kickerMeta={t("wards.wardDetail")}
      title={
        <>
          {t("wards.wardDetail")}{" "}
          <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
            · {occupancyRate}%
          </span>
        </>
      }
      description="Live bed board — update status as beds turn over"
      chips={
        <>
          <span className={HERO_CHIP}>
            <BedDouble size={12} className="text-amber-300" />
            {counts.occupied}/{counts.total} {t("wards.occupied")}
          </span>
          <span className={HERO_CHIP}>
            <CheckCircle2 size={12} className="text-emerald-300" />
            {counts.available} {t("dashboard.available").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<BedDouble size={18} />}
          label={t("dashboard.bedOccupancy")}
          value={`${counts.occupied}/${counts.total}`}
          sub={`${counts.available} ${t("dashboard.available").toLowerCase()}`}
        />
      }
      actions={
        <>
          <Link href="/hospital/wards" className={HERO_GHOST}>
            <ArrowLeft size={13} /> {t("common.back")}
          </Link>
          <button
            type="button"
            onClick={() => beds.refetch()}
            className={HERO_GHOST}
          >
            <RefreshCw size={13} className={beds.isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          <button type="button" onClick={() => setOpen(true)} className={HERO_PRIMARY}>
            <Plus size={14} className="text-emerald-600" /> {t("wards.addBed")}
          </button>
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("dashboard.available")}
          value={beds.isLoading ? "…" : String(counts.available)}
          sub="Ready for admission"
        />
        <StatTile
          icon={<BedDouble size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("dashboard.occupied")}
          value={beds.isLoading ? "…" : String(counts.occupied)}
          sub={`${occupancyRate}% ${t("wards.occupied")}`}
          pulse={counts.occupied > 0}
        />
        <StatTile
          icon={<Sparkles size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("dashboard.cleaning")}
          value={beds.isLoading ? "…" : String(counts.cleaning)}
          sub="Turnover in progress"
        />
        <StatTile
          icon={<Wrench size={16} />}
          tone="bg-slate-100 text-slate-500"
          label={t("dashboard.maintenance")}
          value={beds.isLoading ? "…" : String(counts.maintenance)}
          sub="Out of service"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<BedDouble size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("nav.beds")}
            caption={`${counts.total} ${t("wards.beds")}`}
            action={
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
              >
                <Plus size={13} /> {t("wards.addBed")}
              </button>
            }
          />
          {beds.isLoading ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyBlock
              icon={<BedDouble size={19} />}
              title={t("wards.noBeds")}
              body="Add beds to this ward to start assigning admissions."
              actions={
                <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BTN}>
                  <Plus size={13} /> {t("wards.addBed")}
                </button>
              }
            />
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((b) => {
                const style = BED_STYLE[b.status ?? ""] ?? BED_STYLE.maintenance;
                return (
                  <li
                    key={b.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl p-3 ring-1 ring-inset",
                      style.tile,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold">{b.bedNumber}</span>
                      <span className={cn("h-2 w-2 rounded-full", style.dot)} aria-hidden />
                    </div>
                    <select
                      value={b.status}
                      onChange={(e) =>
                        setStatus.mutate({ bedId: b.id, status: e.target.value })
                      }
                      aria-label={`${b.bedNumber} status`}
                      className="h-8 w-full rounded-lg bg-white/80 px-2 text-xs font-semibold capitalize text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#0284c7]"
                    >
                      <option value="available">available</option>
                      <option value="occupied">occupied</option>
                      <option value="cleaning">cleaning</option>
                      <option value="maintenance">maintenance</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<Hospital size={16} />}
              tone="bg-sky-50 text-sky-600"
              title={t("dashboard.bedOccupancy")}
              caption={`${occupancyRate}% ${t("wards.occupied")}`}
            />
            <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100">
              <span
                className="h-full rounded-l-full bg-amber-500"
                style={{ width: `${counts.total > 0 ? (counts.occupied / counts.total) * 100 : 0}%` }}
              />
              <span
                className="h-full bg-sky-400"
                style={{ width: `${counts.total > 0 ? (counts.cleaning / counts.total) * 100 : 0}%` }}
              />
              <span
                className="h-full bg-slate-300"
                style={{ width: `${counts.total > 0 ? (counts.maintenance / counts.total) * 100 : 0}%` }}
              />
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: t("dashboard.occupied"), value: counts.occupied, dot: "bg-amber-500" },
                { label: t("dashboard.available"), value: counts.available, dot: "bg-emerald-500" },
                { label: t("dashboard.cleaning"), value: counts.cleaning, dot: "bg-sky-400" },
                { label: t("dashboard.maintenance"), value: counts.maintenance, dot: "bg-slate-300" },
              ].map((s) => (
                <li key={s.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden />
                    {s.label}
                  </span>
                  <span className="mt-1 block text-xl font-semibold tabular-nums text-slate-900">
                    {s.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <QuickToolsPanel
            id="ward-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              {
                icon: Hospital,
                label: t("nav.wards"),
                hint: "All units",
                href: "/hospital/wards",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: BedDouble,
                label: t("nav.ipd"),
                hint: "Census",
                href: "/hospital/ipd",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: Plus,
                label: t("nav.beds"),
                hint: "Board",
                href: "/hospital/beds",
                tone: "from-amber-500 to-orange-600 shadow-amber-500/30",
              },
            ]}
          />
        </aside>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t("wards.addBed")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            createBed.mutate({ wardId: id, ...form });
          }}
        >
          <FormField label={t("wards.bedNumber")} required>
            <input
              required
              className={FIELD_INPUT}
              value={form.bedNumber}
              onChange={(e) => setForm({ bedNumber: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={SECONDARY_BTN}>
              {t("common.cancel")}
            </button>
            <button type="submit" className={PRIMARY_BTN}>{t("common.save")}</button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
