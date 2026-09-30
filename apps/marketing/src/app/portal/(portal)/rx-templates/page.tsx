"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Trash2, Edit2, Save, FileText, ClipboardList, Pill, Zap, Star, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea } from "@/portal/components/ui/Form";
import { Drawer } from "@/portal/components/ui/Modal";
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
  PanelSearch,
  PRIMARY_BTN,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

interface Template {
  id: string;
  name: string;
  /** Internal note — stored in the API's `notes` column. */
  notes?: string | null;
  diagnosis?: string | null;
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    timing?: string;
    duration?: string;
  }>;
  useCount?: number;
  updatedAt?: string;
}

interface Page<T> {
  templates?: T[];
  items?: T[];
}

type Sort = "recent" | "used" | "name";

export default function TemplatesPage() {
  const t = useT();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [scope, setScope] = useState<"all" | "used" | "unused">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-rx-templates"],
    queryFn: () => api<Page<Template>>(`/doctor-rx-templates`),
  });

  const list: Template[] = (data?.templates ?? data?.items ?? []) as Template[];

  const del = useMutation({
    mutationFn: (id: string) =>
      api(`/doctor-rx-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("templates.deleted"));
      qc.invalidateQueries({ queryKey: ["doctor-rx-templates"] });
    },
    onError: (err: unknown) => toast.error(t("templates.deleteFailed"), err instanceof Error ? err.message : undefined),
  });

  const totalUses = list.reduce((acc, x) => acc + (x.useCount ?? 0), 0);
  const totalMeds = list.reduce((acc, x) => acc + (x.medicines?.length ?? 0), 0);
  const topTemplate = list.reduce<Template | null>(
    (m, x) => ((x.useCount ?? 0) > (m?.useCount ?? 0) ? x : m),
    null,
  );
  const unused = list.filter((x) => !x.useCount).length;

  const shown = list
    .filter((x) => {
      if (scope === "used" && !x.useCount) return false;
      if (scope === "unused" && x.useCount) return false;
      const term = q.trim().toLowerCase();
      if (!term) return true;
      return [x.name, x.diagnosis, x.notes, ...(x.medicines ?? []).map((m) => m.name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "used"
          ? (b.useCount ?? 0) - (a.useCount ?? 0)
          : (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<ClipboardList size={13} aria-hidden />}
          kicker="Prescribing shortcuts"
          kickerMeta={`${list.length} saved`}
          title={
            <>
              Prescription{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                templates
              </span>
            </>
          }
          description={t("templates.subtitle")}
          chips={
            topTemplate?.useCount ? (
              <span className={HERO_CHIP}>
                <Star size={12} className="text-amber-300" aria-hidden />
                Most used: {topTemplate.name}
              </span>
            ) : (
              <span className={HERO_CHIP}>
                <Zap size={12} className="text-sky-300" aria-hidden />
                Apply in one click from the composer
              </span>
            )
          }
          actions={
            <>
              <Link href="/portal/prescriptions" className={HERO_GHOST}>
                <Pill size={15} aria-hidden />
                Prescriptions
              </Link>
              <button type="button" onClick={() => setCreating(true)} className={HERO_PRIMARY}>
                <Plus size={15} strokeWidth={2.5} className="text-sky-600" aria-hidden />
                {t("templates.new")}
              </button>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Templates"
            icon={<ClipboardList size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : String(list.length)}
            sub="Saved regimens"
            active={scope === "all"}
            onClick={() => setScope("all")}
          />
          <StatTile
            label="Times applied"
            icon={<Zap size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(totalUses)}
            sub="Across all templates"
            active={scope === "used"}
            onClick={() => setScope("used")}
          />
          <StatTile
            label="Medicines"
            icon={<Pill size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(totalMeds)}
            sub={list.length > 0 ? `${(totalMeds / list.length).toFixed(1)} per template` : "Line items"}
          />
          <StatTile
            label="Never used"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(unused)}
            sub={unused > 0 ? "Worth reviewing" : "Every template in use"}
            active={scope === "unused"}
            onClick={() => setScope("unused")}
          />
        </HeroOverlap>
      </div>

      <section className={PANEL} aria-labelledby="tmpl-lib">
        <PanelHeader
          id="tmpl-lib"
          icon={<ClipboardList size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Template library"
          caption={isLoading ? "Loading…" : `${shown.length} of ${list.length} shown`}
        />

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PanelSearch value={q} onChange={setQ} placeholder="Search name, diagnosis or medicine…" ariaLabel="Search templates" />
          <Segmented<Sort>
            ariaLabel="Sort templates"
            value={sort}
            onChange={setSort}
            options={[
              { value: "recent", label: "Recent" },
              { value: "used", label: "Most used" },
              { value: "name", label: "A–Z" },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyBlock
            icon={<FileText size={19} />}
            title={list.length === 0 ? t("templates.empty") : "No matching templates"}
            body={list.length === 0 ? t("templates.emptyBody") : "Try another keyword or clear the filter."}
            actions={
              list.length === 0 ? (
                <button type="button" onClick={() => setCreating(true)} className={PRIMARY_BTN}>
                  <Plus size={13} strokeWidth={2.5} />
                  {t("templates.new")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setScope("all");
                  }}
                  className={SECONDARY_BTN}
                >
                  Clear filters
                </button>
              )
            }
          />
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((tmpl) => {
              const meds = tmpl.medicines ?? [];
              return (
                <li
                  key={tmpl.id}
                  className="group flex flex-col rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-16px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-sm shadow-rose-500/30">
                      <ClipboardList size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{tmpl.name}</h3>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{tmpl.diagnosis || "No diagnosis set"}</p>
                    </div>
                    {tmpl.useCount ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-700">
                        <Zap size={10} />
                        {tmpl.useCount}×
                      </span>
                    ) : null}
                  </div>

                  {tmpl.notes ? (
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500">{tmpl.notes}</p>
                  ) : null}

                  <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-slate-50 p-2.5">
                    {meds.length === 0 ? (
                      <li className="text-[11px] italic text-slate-400">No medicines</li>
                    ) : (
                      meds.slice(0, 4).map((m, i) => (
                        <li key={i} className="flex min-w-0 items-center gap-2 text-[11.5px]">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span className="truncate font-medium text-slate-800">{m.name}</span>
                          <span className="ml-auto shrink-0 truncate text-slate-400">
                            {[m.dosage, m.frequency].filter(Boolean).join(" · ")}
                          </span>
                        </li>
                      ))
                    )}
                    {meds.length > 4 ? (
                      <li className="pl-3.5 text-[11px] font-semibold text-slate-400">+{meds.length - 4} more</li>
                    ) : null}
                  </ul>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className="text-[11px] text-slate-400">
                      {tmpl.updatedAt
                        ? t("templates.updated", { date: format(parseISO(tmpl.updatedAt), "MMM d, yyyy") })
                        : `${meds.length} medicine${meds.length === 1 ? "" : "s"}`}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditing(tmpl)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                      >
                        <Edit2 size={12} />
                        {t("templates.edit")}
                      </button>
                      <button
                        type="button"
                        aria-label={t("templates.delete")}
                        title={t("templates.delete")}
                        onClick={() => {
                          if (confirm(t("templates.deleteConfirm", { name: tmpl.name }))) del.mutate(tmpl.id);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Drawer
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? t("templates.editDrawerTitle", { name: editing.name }) : t("templates.newTitle")}
        size="lg"
      >
        <TemplateForm
          template={editing}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["doctor-rx-templates"] });
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Drawer>
    </div>
  );
}

function TemplateForm({
  template,
  onSaved,
  onCancel,
}: {
  template: Template | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(template?.name ?? "");
  const [diagnosis, setDiagnosis] = useState(template?.diagnosis ?? "");
  const [description, setDescription] = useState(template?.notes ?? "");
  const [meds, setMeds] = useState(
    template?.medicines?.length
      ? template.medicines.map((m) => ({
          name: m.name,
          dosage: m.dosage ?? "",
          frequency: m.frequency ?? "",
          timing: m.timing ?? "",
          duration: m.duration ?? "",
        }))
      : [{ name: "", dosage: "", frequency: "", timing: "", duration: "" }]
  );

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        diagnosis,
        notes: description,
        medicines: meds.filter((m) => m.name.trim()),
      };
      if (template?.id) {
        return api(`/doctor-rx-templates/${template.id}`, {
          method: "PATCH",
          json: body,
        });
      }
      return api(`/doctor-rx-templates`, { method: "POST", json: body });
    },
    onSuccess: () => {
      toast.success(template?.id ? t("templates.updatedToast") : t("templates.created"));
      onSaved();
    },
    onError: (err: unknown) => toast.error(t("templates.saveFailed"), err instanceof Error ? err.message : undefined),
  });

  return (
    <div className="flex flex-col gap-3">
      <Input
        label={t("templates.fieldName")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("templates.fieldNamePlaceholder")}
        required
      />
      <Input
        label={t("templates.fieldDiagnosis")}
        value={diagnosis}
        onChange={(e) => setDiagnosis(e.target.value)}
        placeholder={t("templates.fieldDiagnosisPlaceholder")}
      />
      <Textarea
        label={t("templates.fieldNotes")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />

      <div className="flex flex-col gap-2">
        {meds.map((m, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <Input
                value={m.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setMeds((arr) => arr.map((x, idx) => (idx === i ? { ...x, name: v } : x)));
                }}
                placeholder={t("templates.medicine")}
              />
            </div>
            <div className="col-span-2">
              <Input
                value={m.dosage}
                onChange={(e) => {
                  const v = e.target.value;
                  setMeds((arr) => arr.map((x, idx) => (idx === i ? { ...x, dosage: v } : x)));
                }}
                placeholder={t("templates.dosagePlaceholder")}
              />
            </div>
            <div className="col-span-2">
              <Input
                value={m.frequency}
                onChange={(e) => {
                  const v = e.target.value;
                  setMeds((arr) => arr.map((x, idx) => (idx === i ? { ...x, frequency: v } : x)));
                }}
                placeholder={t("templates.frequencyPlaceholder")}
              />
            </div>
            <div className="col-span-3">
              <Input
                value={m.duration}
                onChange={(e) => {
                  const v = e.target.value;
                  setMeds((arr) => arr.map((x, idx) => (idx === i ? { ...x, duration: v } : x)));
                }}
                placeholder={t("templates.durationPlaceholder")}
              />
            </div>
            <button
              type="button"
              onClick={() => setMeds((arr) => arr.filter((_, idx) => idx !== i))}
              className="col-span-1 h-8 text-text-muted hover:text-danger transition-colors"
              disabled={meds.length === 1}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={12} />}
          onClick={() =>
            setMeds((arr) => [
              ...arr,
              { name: "", dosage: "", frequency: "", timing: "", duration: "" },
            ])
          }
        >
          {t("templates.addMedicine")}
        </Button>
      </div>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-bg py-2">
        <Button variant="ghost" onClick={onCancel}>
          {t("templates.cancel")}
        </Button>
        <Button
          leftIcon={<Save size={14} />}
          disabled={!name.trim() || save.isPending}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          {t("templates.save")}
        </Button>
      </div>
    </div>
  );
}
