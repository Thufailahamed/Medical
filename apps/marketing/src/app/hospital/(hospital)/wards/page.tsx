"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BedDouble,
  Hospital,
  Layers,
  Plus,
  RefreshCw,
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

type Ward = {
  id: string;
  name: string;
  type?: string;
  capacity?: number;
};

const TYPE_TILE: Record<string, string> = {
  general: "bg-sky-50 text-sky-600",
  icu: "bg-rose-50 text-rose-600",
  pediatric: "bg-violet-50 text-violet-600",
  maternity: "bg-pink-50 text-pink-600",
  surgical: "bg-emerald-50 text-emerald-600",
};

export default function WardsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "general", capacity: "" });

  const list = useQuery({
    queryKey: ["wards"],
    queryFn: () => api<{ wards: Ward[] }>("/hospital-portal/wards"),
  });

  const create = useMutation({
    mutationFn: (body: { name: string; type: string; capacity: number }) =>
      api("/hospital-portal/wards", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wards"] });
      setOpen(false);
      setForm({ name: "", type: "general", capacity: "" });
      toast.success("Ward created");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const wards = useMemo(() => list.data?.wards ?? [], [list.data]);
  const totalCapacity = useMemo(
    () => wards.reduce((sum, w) => sum + (w.capacity ?? 0), 0),
    [wards],
  );
  const typeCount = useMemo(
    () => new Set(wards.map((w) => w.type ?? "general")).size,
    [wards],
  );

  const hero = (
    <DoctorHero
      kickerIcon={<Hospital size={13} aria-hidden />}
      kicker={t("nav.inpatient")}
      kickerMeta={t("nav.wards")}
      title={
        <>
          {t("nav.wards")}{" "}
          <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
            · capacity
          </span>
        </>
      }
      description="Ward structure and bed capacity across the facility"
      chips={
        <>
          <span className={HERO_CHIP}>
            <Hospital size={12} className="text-sky-300" />
            {wards.length} {t("nav.wards").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <BedDouble size={12} className="text-emerald-300" />
            {totalCapacity} {t("wards.beds")}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<Layers size={18} />}
          label={t("wards.capacity")}
          value={list.isLoading ? "…" : totalCapacity}
          sub={`${wards.length} ${t("nav.wards").toLowerCase()} · ${typeCount} types`}
        />
      }
      actions={
        <>
          <button type="button" onClick={() => list.refetch()} className={HERO_GHOST}>
            <RefreshCw size={13} className={list.isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          <button type="button" onClick={() => setOpen(true)} className={HERO_PRIMARY}>
            <Plus size={14} className="text-emerald-600" /> {t("wards.newWard")}
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
          icon={<Hospital size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("nav.wards")}
          value={list.isLoading ? "…" : String(wards.length)}
          sub="Care units in this facility"
        />
        <StatTile
          icon={<BedDouble size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("wards.capacity")}
          value={list.isLoading ? "…" : String(totalCapacity)}
          sub={`${t("wards.beds")} total`}
          href="/hospital/beds"
        />
        <StatTile
          icon={<Layers size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Ward types"
          value={list.isLoading ? "…" : String(typeCount)}
          sub="General · ICU · pediatric…"
        />
        <StatTile
          icon={<Plus size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("wards.newWard")}
          value="→"
          sub="Add a care unit"
          onClick={() => setOpen(true)}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<Hospital size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("nav.wards")}
            caption={
              list.isLoading
                ? t("common.loading")
                : `${wards.length} ${t("nav.wards").toLowerCase()} · ${totalCapacity} ${t("wards.beds")}`
            }
            action={
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
              >
                <Plus size={13} /> {t("wards.newWard")}
              </button>
            }
          />
          {list.isLoading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : wards.length === 0 ? (
            <EmptyBlock
              icon={<Hospital size={19} />}
              title={t("wards.noWards")}
              body="Create your first ward to start assigning beds and admissions."
              actions={
                <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BTN}>
                  <Plus size={13} /> {t("wards.newWard")}
                </button>
              }
            />
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {wards.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/hospital/wards/${w.id}`}
                    className="group relative flex items-center gap-3.5 rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                  >
                    <span
                      className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-sky-500"
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "ml-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-[10px]",
                        TYPE_TILE[w.type ?? ""] ?? "bg-slate-100 text-slate-500",
                      )}
                      aria-hidden
                    >
                      <Hospital size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                        {w.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs capitalize text-slate-400">
                        {w.type ?? "general"}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        {w.capacity ?? 0} {t("wards.beds")}
                      </span>
                      <ArrowRight size={14} className="text-slate-300 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="wards-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              {
                icon: BedDouble,
                label: t("nav.beds"),
                hint: "Board",
                href: "/hospital/beds",
                tone: "from-amber-500 to-orange-600 shadow-amber-500/30",
              },
              {
                icon: Hospital,
                label: t("nav.ipd"),
                hint: "Census",
                href: "/hospital/ipd",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: Plus,
                label: t("nav.patients"),
                hint: "Directory",
                href: "/hospital/reception/patients",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />

          <section className={PANEL}>
            <PanelHeader
              icon={<BedDouble size={16} />}
              tone="bg-amber-50 text-amber-600"
              title={t("nav.beds")}
              caption={t("beds.subtitle")}
              href="/hospital/beds"
              linkLabel={t("dashboard.viewAll")}
            />
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              The beds board shows live occupancy per ward — open a ward to add
              beds or change bed status.
            </p>
          </section>
        </aside>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t("wards.newWard")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              ...form,
              capacity: parseInt(form.capacity || "0", 10),
            });
          }}
        >
          <FormField label={t("common.name")} required>
            <input
              required
              className={FIELD_INPUT}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label="Type">
            <select
              className={FIELD_INPUT}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="general">General</option>
              <option value="icu">ICU</option>
              <option value="pediatric">Pediatric</option>
              <option value="maternity">Maternity</option>
              <option value="surgical">Surgical</option>
            </select>
          </FormField>
          <FormField label={t("wards.capacity")} required>
            <input
              required
              type="number"
              min={1}
              className={FIELD_INPUT}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={SECONDARY_BTN}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={create.isPending} className={PRIMARY_BTN}>
              {t("common.save")}
            </button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
