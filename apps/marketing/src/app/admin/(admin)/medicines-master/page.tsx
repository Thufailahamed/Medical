"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  FlaskConical,
  Pencil,
  Pill as PillIcon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { cn } from "@/portal/lib/utils";
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
  RowAccent,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { ROW_BTN_QUIET } from "@/portal/components/admin/AdminDirectory";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  id: string;
  genericName: string;
  brandName: string | null;
  strength: string | null;
  scheduleClass: string | null;
  isGeneric: boolean | null;
  active: boolean | null;
  notes: string | null;
};

type FormState = {
  genericName: string;
  brandName: string;
  strength: string;
  scheduleClass: string;
  isGeneric: boolean;
  active: boolean;
};

const EMPTY: FormState = {
  genericName: "",
  brandName: "",
  strength: "",
  scheduleClass: "",
  isGeneric: true,
  active: true,
};

type TypeFilter = "all" | "generic" | "brand";

export default function AdminMedicinesMasterPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: adminQk.medicinesMaster({ q: debouncedQ }),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (debouncedQ) qs.set("q", debouncedQ);
      qs.set("limit", "200");
      return adminApi<{ items: Row[]; total: number }>(`/admin/medicines-master?${qs.toString()}`);
    },
  });

  // Unfiltered snapshot for the stat strip — keeps the tiles accurate while a
  // search term narrows the list below.
  const { data: stats } = useQuery({
    queryKey: adminQk.medicinesMaster({ stats: "all" }),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/medicines-master?limit=500`),
    staleTime: 60_000,
  });
  const statItems = useMemo(() => stats?.items ?? [], [stats?.items]);
  const counts = useMemo(
    () => ({
      total: stats?.total ?? statItems.length,
      generic: statItems.filter((m) => m.isGeneric !== false).length,
      brand: statItems.filter((m) => m.isGeneric === false).length,
      active: statItems.filter((m) => m.active !== false).length,
    }),
    [stats?.total, statItems],
  );
  const activePct = statItems.length ? Math.round((counts.active / statItems.length) * 100) : null;

  const shown = useMemo(() => {
    const items = data?.items ?? [];
    if (typeFilter === "generic") return items.filter((m) => m.isGeneric !== false);
    if (typeFilter === "brand") return items.filter((m) => m.isGeneric === false);
    return items;
  }, [data?.items, typeFilter]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        genericName: form.genericName,
        brandName: form.brandName || null,
        strength: form.strength || null,
        scheduleClass: form.scheduleClass || null,
        isGeneric: form.isGeneric,
        active: form.active,
      };
      if (editing) {
        return adminApiWithStepUp(`/admin/medicines-master/${editing.id}`, {
          method: "PATCH",
          json: payload,
        });
      }
      return adminApiWithStepUp(`/admin/medicines-master`, {
        method: "POST",
        json: payload,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Updated" : "Created");
      qc.invalidateQueries({ queryKey: ["admin", "medicines-master"] });
      setEditing(null);
      setCreating(false);
      setForm(EMPTY);
    },
    onError: (e: unknown) => toast.error("Save failed", e instanceof Error ? e.message : undefined),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setCreating(true);
  }
  function openEdit(row: Row) {
    setEditing(row);
    setForm({
      genericName: row.genericName,
      brandName: row.brandName ?? "",
      strength: row.strength ?? "",
      scheduleClass: row.scheduleClass ?? "",
      isGeneric: row.isGeneric ?? true,
      active: row.active ?? true,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<BookOpen size={13} aria-hidden />}
          kicker="Catalog"
          kickerMeta={stats ? `${counts.total.toLocaleString()} medicines` : "Medicines master"}
          title={
            <>
              Medicines{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                catalogue
              </span>
            </>
          }
          description="The master list of medicines prescribers can pick from — generics, brands, strengths and schedule classes."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                Step-up auth on edits
              </span>
              {counts.active < counts.total ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <PillIcon size={12} aria-hidden />
                  {counts.total - counts.active} inactive
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <button type="button" onClick={() => qc.invalidateQueries({ queryKey: ["admin", "medicines-master"] })} className={HERO_GHOST}>
                <RefreshCw size={15} aria-hidden />
                Refresh
              </button>
              <button type="button" onClick={openCreate} className={HERO_PRIMARY}>
                <Plus size={15} className="text-sky-600" aria-hidden />
                Add medicine
              </button>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Total medicines"
            icon={<BookOpen size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={stats ? counts.total.toLocaleString() : "…"}
            sub="In the master catalogue"
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
          />
          <StatTile
            label="Generic"
            icon={<FlaskConical size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={stats ? counts.generic.toLocaleString() : "…"}
            sub="Non-branded entries"
            active={typeFilter === "generic"}
            onClick={() => setTypeFilter("generic")}
          />
          <StatTile
            label="Brand"
            icon={<Tag size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={stats ? counts.brand.toLocaleString() : "…"}
            sub="Branded products"
            active={typeFilter === "brand"}
            onClick={() => setTypeFilter("brand")}
          />
          <StatTile
            label="Active"
            icon={<CheckCircle2 size={16} />}
            tone="bg-teal-50 text-teal-600"
            value={stats ? counts.active.toLocaleString() : "…"}
            sub="Available to prescribers"
            progress={activePct}
          />
        </HeroOverlap>
      </div>

      {/* ── Catalogue ──────────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="med-list">
        <PanelHeader
          id="med-list"
          icon={<PillIcon size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Medicines"
          caption={
            isLoading || !data
              ? "Loading catalogue…"
              : `${shown.length} of ${data.total.toLocaleString()} shown${debouncedQ ? ` · matching “${debouncedQ}”` : ""}`
          }
        />

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PanelSearch value={q} onChange={setQ} placeholder="Search generic or brand…" ariaLabel="Search medicines" />
          <Segmented<TypeFilter>
            ariaLabel="Medicine type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "all", label: "All" },
              { value: "generic", label: "Generic" },
              { value: "brand", label: "Brand" },
            ]}
          />
        </div>

        {isLoading || !data ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyBlock
            icon={<PillIcon size={19} />}
            title={debouncedQ || typeFilter !== "all" ? "No matching medicines" : "No medicines yet"}
            body={
              debouncedQ || typeFilter !== "all"
                ? "Try another name or clear the type filter."
                : "Add the first medicine to the master catalogue."
            }
            actions={
              debouncedQ || typeFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setTypeFilter("all");
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                >
                  <Plus size={14} aria-hidden />
                  Add medicine
                </button>
              )
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {shown.map((m) => (
              <li key={m.id} className={LIST_ROW}>
                <RowAccent
                  className={
                    m.active === false ? "bg-slate-300" : m.isGeneric ? "bg-emerald-500" : "bg-violet-500"
                  }
                />
                <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                      m.active === false
                        ? "bg-slate-100 text-slate-400"
                        : m.isGeneric
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-violet-50 text-violet-600",
                    )}
                  >
                    <PillIcon size={17} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{m.genericName}</span>
                      {m.strength ? (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
                          {m.strength}
                        </span>
                      ) : null}
                      {m.scheduleClass ? <Pill tone="info">{m.scheduleClass}</Pill> : null}
                      <Pill tone={m.isGeneric ? "success" : "violet"}>{m.isGeneric ? "Generic" : "Brand"}</Pill>
                      {m.active === false ? <Pill tone="danger">Inactive</Pill> : null}
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      {m.brandName ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Tag size={11} aria-hidden />
                          {m.brandName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Tag size={11} aria-hidden />
                          No brand name
                        </span>
                      )}
                      {m.notes ? (
                        <span className="inline-flex min-w-0 items-center gap-1 truncate" title={m.notes}>
                          <FileText size={11} aria-hidden />
                          {m.notes}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                  <button type="button" onClick={() => openEdit(m)} className={ROW_BTN_QUIET}>
                    <Pencil size={14} aria-hidden />
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? "Edit medicine" : "New medicine"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              onClick={() => save.mutate()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Generic name" required>
            <Input
              value={form.genericName}
              onChange={(e) => setForm({ ...form, genericName: e.target.value })}
            />
          </Field>
          <Field label="Brand name">
            <Input
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            />
          </Field>
          <Field label="Strength">
            <Input
              value={form.strength}
              onChange={(e) => setForm({ ...form, strength: e.target.value })}
            />
          </Field>
          <Field label="Schedule class">
            <Input
              value={form.scheduleClass}
              onChange={(e) => setForm({ ...form, scheduleClass: e.target.value })}
            />
          </Field>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isGeneric}
                onChange={(e) => setForm({ ...form, isGeneric: e.target.checked })}
              />
              Generic
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
