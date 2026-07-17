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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Server,
  Plus,
  RefreshCw,
  Zap,
  Pencil,
  Power,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

import { api, qk } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";

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

export default function PacsSettingsPage() {
  const t = useT();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin =
    user?.role === "hospital_admin" || user?.role === "super_admin";

  const { data, isLoading } = useQuery({
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
    onError: (err: any) => {
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
    onError: (err: any) => {
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
    onSuccess: (res, id) => {
      if (res.ok) {
        toast.success(`${t("pacs.testResult.ok")} (${res.roundtripMs}ms)`);
      } else {
        const key = `pacs.testResult.${res.error ?? "transient"}` as const;
        toast.error(t(key));
      }
      qc.invalidateQueries({ queryKey: qk.pacsIntegrations });
      void id;
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
      <div className="space-y-4">
        <PageHeader title={t("pacs.title")} subtitle="" />
        <Card>
          <div className="p-6 text-sm text-text-muted">
            Only hospital administrators can configure PACS integrations.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pacs.title")}
        subtitle={t("pacs.subtitle")}
      />

      {/* List */}
      <Card>
        <CardHeader
          title={t("pacs.listTitle")}
          icon={<Server size={15} className="text-brand" />}
        />
        {isLoading ? (
          <div className="space-y-2 mt-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : integrations.length === 0 ? (
          <Empty title={t("pacs.listEmpty")} className="py-10" />
        ) : (
          <ul className="mt-4 space-y-3">
            {integrations.map((integ) => (
              <li
                key={integ.id}
                className="border border-border rounded-xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text">{integ.name}</span>
                    <StatusPill status={integ.lastSyncStatus} t={t} />
                    {integ.consecutiveFailures > 0 && (
                      <Pill tone="warn">
                        {integ.consecutiveFailures}×
                      </Pill>
                    )}
                    {!integ.enabled && <Pill tone="neutral">off</Pill>}
                  </div>
                  <div className="text-xs text-text-muted font-mono truncate mt-1">
                    {integ.baseUrl}
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">
                    Every {integ.syncIntervalMinutes} min ·{" "}
                    {integ.lastSyncAt
                      ? `Last sync ${new Date(integ.lastSyncAt).toLocaleString()}`
                      : "Never synced"}
                  </div>
                  {integ.lastSyncError && (
                    <div className="text-[11px] text-red-700 mt-1 truncate">
                      {integ.lastSyncError}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => testMutation.mutate(integ.id)}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Zap size={12} />
                    )}
                    {t("pacs.actions.testConnection")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => syncMutation.mutate(integ.id)}
                    disabled={syncMutation.isPending || !integ.enabled}
                  >
                    {syncMutation.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    {t("pacs.actions.syncNow")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(integ)}
                  >
                    <Pencil size={12} /> {t("pacs.actions.edit")}
                  </Button>
                  {integ.enabled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => disableMutation.mutate(integ.id)}
                    >
                      <Power size={12} /> {t("pacs.actions.disable")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Add / Edit form */}
      <Card>
        <CardHeader
          title={form?.id ? t("pacs.editTitle") : t("pacs.addTitle")}
          icon={form?.id ? <Pencil size={15} /> : <Plus size={15} />}
        />
        {!form ? (
          <div className="mt-4">
            <Button onClick={() => { setForm({ ...EMPTY_FORM }); setFormError(null); }}>
              <Plus size={14} /> {t("pacs.actions.addNew")}
            </Button>
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
                className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label={t("pacs.fields.baseUrl")} hint={t("pacs.fields.baseUrlHint")}>
              <input
                type="url"
                className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-sm font-mono"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://pacs.example.com/dicom-web"
                required
              />
            </Field>
            <Field label={t("pacs.fields.username")}>
              <input
                type="text"
                className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-sm"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="off"
                placeholder={form.id ? "(unchanged)" : ""}
              />
            </Field>
            <Field label={t("pacs.fields.password")} hint={form.id ? t("pacs.fields.passwordHint") : undefined}>
              <input
                type="password"
                className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-sm"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                placeholder={form.id ? "(unchanged)" : ""}
              />
            </Field>
            <Field label={t("pacs.fields.interval")}>
              <input
                type="number"
                min={5}
                max={1440}
                className="w-32 h-9 px-3 rounded-lg border border-border bg-surface text-sm"
                value={form.syncIntervalMinutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    syncIntervalMinutes: Number(e.target.value),
                  })
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              {t("pacs.fields.enabled")}
            </label>
            {formError && (
              <div className="text-xs text-red-700">{formError}</div>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={12} />
                )}
                {t("pacs.actions.save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setForm(null);
                  setFormError(null);
                }}
              >
                <XCircle size={12} /> {t("pacs.actions.cancel")}
              </Button>
            </div>
          </form>
        )}
      </Card>
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
    <div className="space-y-1">
      <label className="text-xs font-medium text-text-soft uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

function StatusPill({
  status,
  t,
}: {
  status: PacsIntegration["lastSyncStatus"];
  t: (k: string) => string;
}) {
  const map: Record<PacsIntegration["lastSyncStatus"], { tone: any; icon: any }> = {
    idle: { tone: "neutral", icon: <Power size={11} /> },
    running: { tone: "info", icon: <Loader2 size={11} className="animate-spin" /> },
    succeeded: { tone: "success", icon: <CheckCircle2 size={11} /> },
    failed: { tone: "warn", icon: <XCircle size={11} /> },
  };
  const m = map[status];
  return (
    <Pill tone={m.tone} className="gap-1 inline-flex items-center">
      {m.icon}
      <span>{t(`pacs.status.${status}`)}</span>
    </Pill>
  );
}