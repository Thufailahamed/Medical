"use client";

// Hospital-admin PACS integrations page.
//
// Onboarding surface for the Tier 2 PACS pull engine. Lists
// configured integrations, lets the admin add / edit / disable them,
// and exposes per-row "Test connection" + "Sync now" actions.
//
// Every state mutation goes through the /hospital-admin/pacs/* API.
// Credentials are entered as plaintext over the form, then encrypted
// server-side via the KEK envelope before being written — the wire
// response never includes the credential plaintext, and the page
// never persists it client-side beyond the form draft state.

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Server,
  Settings as SettingsIcon,
  Shield,
  XCircle,
  Zap,
} from "lucide-react";

import { api, qk } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
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
  FIELD_LABEL,
  HeroPulse,
  PanelSkeleton,
  QuickToolsPanel,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type PacsIntegration = {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  syncIntervalMinutes: number;
  kekVersion: string;
  lastSyncAt: string | null;
  lastSyncStatus: "idle" | "running" | "succeeded" | "failed";
  lastSyncError: string | null;
  consecutiveFailures: number;
};

type FormState = {
  id?: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  syncIntervalMinutes: number;
  enabled: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  baseUrl: "",
  username: "",
  password: "",
  syncIntervalMinutes: 60,
  enabled: true,
};

const STATUS_STYLE: Record<
  PacsIntegration["lastSyncStatus"],
  { badge: string; icon: React.ReactNode; rail: "slate" | "sky" | "emerald" | "amber" }
> = {
  idle: { badge: TONE_BADGE.slate, icon: <Power size={11} />, rail: "slate" },
  running: { badge: TONE_BADGE.sky, icon: <Loader2 size={11} className="animate-spin" />, rail: "sky" },
  succeeded: { badge: TONE_BADGE.emerald, icon: <CheckCircle2 size={11} />, rail: "emerald" },
  failed: { badge: TONE_BADGE.amber, icon: <XCircle size={11} />, rail: "amber" },
};

export default function PacsSettingsPage() {
  const t = useT();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin =
    user?.role === "hospital_admin" || user?.role === "super_admin";

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: qk.pacsIntegrations,
    queryFn: () => api<{ integrations: PacsIntegration[] }>("/hospital-admin/pacs/integrations"),
    enabled: isAdmin,
  });
  const integrations = data?.integrations ?? [];

  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: Omit<FormState, "id">) =>
      api<{ ok: true; id: string }>("/hospital-admin/pacs/integrations", {
        method: "POST",
        json: input,
      }),
    onSuccess: () => {
      toast.success(t("pacs.actions.save"));
      qc.invalidateQueries({ queryKey: qk.pacsIntegrations });
      setForm(null);
    },
    onError: (err: Error) => {
      setFormError(err?.message ?? "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: FormState) =>
      api<{ ok: true }>(`/hospital-admin/pacs/integrations/${input.id}`, {
        method: "PUT",
        json: input,
      }),
    onSuccess: () => {
      toast.success(t("pacs.actions.save"));
      qc.invalidateQueries({ queryKey: qk.pacsIntegrations });
      setForm(null);
    },
    onError: (err: Error) => {
      setFormError(err?.message ?? "error");
    },
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/hospital-admin/pacs/integrations/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pacsIntegrations });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean; roundtripMs?: number; error?: string }>(
        `/hospital-admin/pacs/integrations/${id}/test-connection`,
        { method: "POST" }
      ),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`${t("pacs.testResult.ok")} (${res.roundtripMs}ms)`);
      } else {
        const key = `pacs.testResult.${res.error ?? "transient"}` as const;
        toast.error(t(key));
      }
      qc.invalidateQueries({ queryKey: qk.pacsIntegrations });
    },
    onError: () => toast.error(t("pacs.testResult.transient")),
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean; patients: number; studies: number; instances: number }>(
        `/hospital-admin/pacs/integrations/${id}/sync-now`,
        { method: "POST" }
      ),
    onSuccess: (res) => {
      toast.success(
        t("pacs.syncResult.completed", {
          studies: res.studies ?? 0,
          instances: res.instances ?? 0,
        })
      );
      qc.invalidateQueries({ queryKey: qk.pacsIntegrations });
    },
    onError: () => toast.error(t("pacs.syncResult.failed")),
  });

  function startEdit(integ: PacsIntegration) {
    setForm({
      id: integ.id,
      name: integ.name,
      baseUrl: integ.baseUrl,
      username: "",
      password: "",
      syncIntervalMinutes: integ.syncIntervalMinutes,
      enabled: integ.enabled,
    });
    setFormError(null);
  }

  function submitForm() {
    if (!form) return;
    setFormError(null);
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("nameRequired");
    if (!form.baseUrl.trim()) missing.push("baseUrlRequired");
    if (!form.id && !form.username) missing.push("usernameRequired");
    if (!form.id && !form.password) missing.push("passwordRequired");
    if (
      form.syncIntervalMinutes < 5 ||
      form.syncIntervalMinutes > 1440
    ) {
      missing.push("intervalInvalid");
    }
    try {
      new URL(form.baseUrl);
    } catch {
      missing.push("urlInvalid");
    }
    if (missing.length > 0) {
      setFormError(t(`pacs.errors.${missing[0]}`));
      return;
    }
    if (form.id) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
        <DoctorHero
          kickerIcon={<Server size={13} aria-hidden />}
          kicker={t("nav.settings")}
          kickerMeta={t("nav.pacsIntegrations")}
          title={t("pacs.title")}
          description="Only hospital administrators can configure PACS integrations."
        />
        <section className={PANEL}>
          <EmptyBlock
            icon={<Shield size={19} />}
            title={t("pacs.title")}
            body="Only hospital administrators can configure PACS integrations."
          />
        </section>
      </div>
    );
  }

  const enabledCount = integrations.filter((i) => i.enabled).length;
  const failingCount = integrations.filter((i) => i.consecutiveFailures > 0 || i.lastSyncStatus === "failed").length;

  const hero = (
    <DoctorHero
      kickerIcon={<Server size={13} aria-hidden />}
      kicker={t("nav.settings")}
      kickerMeta={t("nav.pacsIntegrations")}
      title={
        <>
          {t("pacs.title")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · imaging
          </span>
        </>
      }
      description={t("pacs.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Server size={12} className="text-sky-300" />
            {integrations.length} integrations
          </span>
          <span className={HERO_CHIP}>
            <CheckCircle2 size={12} className="text-emerald-300" />
            {enabledCount} enabled
          </span>
          {failingCount > 0 ? (
            <span className={HERO_CHIP}>
              <XCircle size={12} className="text-rose-300" />
              {failingCount} failing
            </span>
          ) : null}
        </>
      }
      aside={
        <HeroPulse
          icon={<Server size={18} />}
          label={t("pacs.listTitle")}
          value={isLoading ? "…" : integrations.length}
          sub={`${enabledCount} enabled · ${failingCount} failing`}
        />
      }
      actions={
        <>
          <button type="button" onClick={() => refetch()} className={HERO_GHOST}>
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/settings" className={HERO_GHOST}>
            <ArrowLeft size={14} />
            {t("nav.settings")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setForm({ ...EMPTY_FORM });
              setFormError(null);
            }}
            className={HERO_PRIMARY}
          >
            <Plus size={14} className="text-emerald-600" />
            {t("pacs.actions.addNew")}
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
          icon={<Server size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("pacs.listTitle")}
          value={isLoading ? "…" : String(integrations.length)}
          sub="Configured endpoints"
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("pacs.fields.enabled")}
          value={isLoading ? "…" : String(enabledCount)}
          sub="Actively syncing"
        />
        <StatTile
          icon={<XCircle size={16} />}
          tone={failingCount ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}
          label="Failures"
          value={isLoading ? "…" : String(failingCount)}
          sub="Consecutive sync failures"
          pulse={failingCount > 0}
        />
        <StatTile
          icon={<Shield size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="KEK"
          value={integrations[0]?.kekVersion ?? "—"}
          sub="Envelope encryption"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-7")}>
          <PanelHeader
            icon={<Server size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("pacs.listTitle")}
            caption={isLoading ? t("common.loading") : `${integrations.length}`}
          />
          {isLoading ? (
            <PanelSkeleton rows={3} className="mt-4" />
          ) : integrations.length === 0 ? (
            <EmptyBlock
              icon={<Server size={19} />}
              title={t("pacs.listEmpty")}
              body="Connect a PACS endpoint to start pulling imaging studies."
              actions={
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...EMPTY_FORM });
                    setFormError(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Plus size={13} /> {t("pacs.actions.addNew")}
                </button>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {integrations.map((integ) => {
                const st = STATUS_STYLE[integ.lastSyncStatus] ?? STATUS_STYLE.idle;
                return (
                  <li
                    key={integ.id}
                    className="group relative overflow-hidden rounded-2xl border border-[color:var(--ink-border)] bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-1",
                        integ.lastSyncStatus === "failed" || integ.consecutiveFailures > 0
                          ? "bg-amber-400"
                          : integ.enabled
                            ? "bg-emerald-400"
                            : "bg-slate-200"
                      )}
                    />
                    <div className="flex flex-col gap-3 pl-1 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-600">
                            <Server size={15} />
                          </span>
                          <span className="truncate text-sm font-bold text-slate-900">{integ.name}</span>
                          <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", st.badge)}>
                            {st.icon}
                            {t(`pacs.status.${integ.lastSyncStatus}`)}
                          </span>
                          {integ.consecutiveFailures > 0 && (
                            <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold", TONE_BADGE.amber)}>
                              {integ.consecutiveFailures}×
                            </span>
                          )}
                          {!integ.enabled && (
                            <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold", TONE_BADGE.slate)}>off</span>
                          )}
                        </div>
                        <div className="mt-1.5 truncate font-mono text-xs text-slate-500">{integ.baseUrl}</div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          Every {integ.syncIntervalMinutes} min ·{" "}
                          {integ.lastSyncAt
                            ? `Last sync ${new Date(integ.lastSyncAt).toLocaleString()}`
                            : "Never synced"}
                        </div>
                        {integ.lastSyncError && (
                          <div className="mt-1 truncate text-[11px] font-medium text-rose-600">
                            {integ.lastSyncError}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => testMutation.mutate(integ.id)}
                          disabled={testMutation.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-border)] px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          {testMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                          {t("pacs.actions.testConnection")}
                        </button>
                        <button
                          type="button"
                          onClick={() => syncMutation.mutate(integ.id)}
                          disabled={syncMutation.isPending || !integ.enabled}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-border)] px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          {syncMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          {t("pacs.actions.syncNow")}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(integ)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-50"
                        >
                          <Pencil size={12} /> {t("pacs.actions.edit")}
                        </button>
                        {integ.enabled && (
                          <button
                            type="button"
                            onClick={() => disableMutation.mutate(integ.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            <Power size={12} /> {t("pacs.actions.disable")}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-5 xl:col-span-5">
          <section className={PANEL}>
            <PanelHeader
              icon={form?.id ? <Pencil size={16} /> : <Plus size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={form?.id ? t("pacs.editTitle") : t("pacs.addTitle")}
            />
            {!form ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...EMPTY_FORM });
                    setFormError(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Plus size={14} /> {t("pacs.actions.addNew")}
                </button>
              </div>
            ) : (
              <form
                className="mt-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitForm();
                }}
              >
                <Field label={t("pacs.fields.name")}>
                  <input
                    type="text"
                    className={FIELD_INPUT}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label={t("pacs.fields.baseUrl")} hint={t("pacs.fields.baseUrlHint")}>
                  <input
                    type="url"
                    className={cn(FIELD_INPUT, "font-mono")}
                    value={form.baseUrl}
                    onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                    placeholder="https://pacs.example.com/dicom-web"
                    required
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("pacs.fields.username")}>
                    <input
                      type="text"
                      className={FIELD_INPUT}
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      autoComplete="off"
                      placeholder={form.id ? "(unchanged)" : ""}
                    />
                  </Field>
                  <Field label={t("pacs.fields.password")} hint={form.id ? t("pacs.fields.passwordHint") : undefined}>
                    <input
                      type="password"
                      className={FIELD_INPUT}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="new-password"
                      placeholder={form.id ? "(unchanged)" : ""}
                    />
                  </Field>
                </div>
                <Field label={t("pacs.fields.interval")}>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    className={cn(FIELD_INPUT, "w-32")}
                    value={form.syncIntervalMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        syncIntervalMinutes: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                  />
                  {t("pacs.fields.enabled")}
                </label>
                {formError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    {formError}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}
                    {t("pacs.actions.save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(null);
                      setFormError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--ink-border)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <XCircle size={13} /> {t("pacs.actions.cancel")}
                  </button>
                </div>
              </form>
            )}
          </section>

          <QuickToolsPanel
            id="pacs-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: SettingsIcon, label: t("nav.settings"), hint: t("settings.title"), href: "/hospital/settings", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Shield, label: t("nav.staff"), hint: "Directory", href: "/hospital/staff", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className={FIELD_LABEL}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
