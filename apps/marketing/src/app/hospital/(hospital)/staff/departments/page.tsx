"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Mail,
  Plus,
  RefreshCw,
  Stethoscope,
  Trash2,
  Users,
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
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_INPUT,
  HeroPulse,
  PanelSkeleton,
  QuickToolsPanel,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

interface Department {
  id: string;
  name: string;
  headDoctorName?: string | null;
  active?: boolean;
}

const DEPT_TONES = [
  "bg-sky-50 text-sky-600",
  "bg-emerald-50 text-emerald-600",
  "bg-violet-50 text-violet-600",
  "bg-amber-50 text-amber-600",
  "bg-rose-50 text-rose-600",
  "bg-teal-50 text-teal-600",
];

export default function DepartmentsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "" });

  const list = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<{ departments: Department[] }>("/hospital-portal/departments"),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/hospital-portal/departments", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setOpen(false);
      setForm({ name: "" });
      toast.success("Department created");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-portal/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });

  const departments = list.data?.departments ?? [];
  const activeCount = departments.filter((d) => d.active).length;
  const withHead = departments.filter((d) => d.headDoctorName).length;

  const hero = (
    <DoctorHero
      kickerIcon={<Building2 size={13} aria-hidden />}
      kicker={t("nav.admin")}
      kickerMeta={t("nav.departments")}
      title={
        <>
          {t("nav.departments")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · structure
          </span>
        </>
      }
      description={`${departments.length} ${t("nav.departments").toLowerCase()} · ${withHead} with a head of department`}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Building2 size={12} className="text-violet-300" />
            {departments.length} {t("nav.departments").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <CheckCircle2 size={12} className="text-emerald-300" />
            {activeCount} active
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<Building2 size={18} />}
          label={t("nav.departments")}
          value={list.isLoading ? "…" : departments.length}
          sub={`${withHead} with head doctor`}
        />
      }
      actions={
        <>
          <button type="button" onClick={() => list.refetch()} className={HERO_GHOST}>
            <RefreshCw size={13} className={list.isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/staff" className={HERO_GHOST}>
            <Users size={14} />
            {t("nav.staff")}
          </Link>
          <button type="button" onClick={() => setOpen(true)} className={HERO_PRIMARY}>
            <Plus size={14} className="text-emerald-600" />
            {t("departments.new")}
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
          icon={<Building2 size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("nav.departments")}
          value={list.isLoading ? "…" : String(departments.length)}
          sub={t("nav.departments")}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("settings.status")}
          value={list.isLoading ? "…" : String(activeCount)}
          sub="Active"
        />
        <StatTile
          icon={<Stethoscope size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("departments.noHead")}
          value={list.isLoading ? "…" : String(withHead)}
          sub="Departments with a head"
        />
        <StatTile
          icon={<ArrowLeft size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("nav.staff")}
          value="→"
          sub={t("dashboard.viewAll")}
          href="/hospital/staff"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<Building2 size={16} />}
            tone="bg-violet-50 text-violet-600"
            title={t("nav.departments")}
            caption={list.isLoading ? t("common.loading") : `${departments.length}`}
            action={
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <Plus size={13} /> {t("departments.new")}
              </button>
            }
          />
          {list.isLoading ? (
            <PanelSkeleton rows={4} className="mt-4" />
          ) : !departments.length ? (
            <EmptyBlock
              icon={<Building2 size={19} />}
              title={t("departments.empty")}
              body="Create a department to organise staff."
              actions={
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Plus size={13} /> {t("departments.new")}
                </button>
              }
            />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {departments.map((d, i) => (
                <div
                  key={d.id}
                  className="group relative overflow-hidden rounded-2xl border border-[color:var(--ink-border)] bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", d.active ? "bg-emerald-400" : "bg-slate-200")} />
                  <div className="flex items-start gap-3 pl-1">
                    <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", DEPT_TONES[i % DEPT_TONES.length])}>
                      <Building2 size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{d.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        <Stethoscope size={11} className="mr-1 inline" />
                        {d.headDoctorName ?? t("departments.noHead")}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", d.active ? TONE_BADGE.emerald : TONE_BADGE.slate)}>
                          {d.active ? "active" : "inactive"}
                        </span>
                        {d.active ? (
                          <button
                            type="button"
                            onClick={() => remove.mutate(d.id)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-rose-600 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50"
                          >
                            <Trash2 size={11} /> {t("common.delete")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="departments-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: Users, label: t("nav.staff"), hint: "Directory", href: "/hospital/staff", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Mail, label: t("nav.staffInvites"), hint: t("staff.inviteStaff"), href: "/hospital/staff/invites", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
              { icon: Building2, label: t("nav.settings"), hint: t("settings.title"), href: "/hospital/settings", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
            ]}
          />
        </aside>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t("departments.new")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form);
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
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-[color:var(--ink-border)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {t("common.save")}
            </button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
