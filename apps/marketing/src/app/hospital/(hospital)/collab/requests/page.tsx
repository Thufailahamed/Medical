"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Plus,
  Send,
  XCircle,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Modal } from "@/portal/components/ui/Modal";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatDate } from "@/hospital/lib/format";
import { cn } from "@/portal/lib/utils";
import { toast } from "@/portal/components/ui/Toast";

type Tab = "outgoing" | "incoming";

const STATUS_TONE: Record<string, "info" | "success" | "warn" | "danger" | "neutral"> = {
  pending: "warn",
  approved: "success",
  declined: "danger",
  expired: "neutral",
  revoked: "neutral",
};

const SCOPE_TONE: Record<string, "info" | "neutral"> = {
  full: "info",
  records: "neutral",
  prescriptions: "neutral",
  lab: "neutral",
};

export default function CollabRequestsPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("outgoing");
  const [newOpen, setNewOpen] = useState(false);

  const outgoing = useQuery({
    queryKey: ["hospital-share-requests", "outgoing"],
    queryFn: () => api<{ items: any[] }>("/hospital-share-requests/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["hospital-share-requests", "incoming"],
    queryFn: () => api<{ items: any[] }>("/hospital-share-requests/incoming"),
    refetchInterval: 30_000,
  });

  const data = tab === "outgoing" ? outgoing : incoming;
  const items = data.data?.items ?? [];

  const approve = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-share-requests/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const decline = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api(`/hospital-share-requests/${id}/decline`, {
        method: "POST",
        json: { reason: reason ?? "" },
      }),
    onSuccess: () => {
      toast.success("Declined");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-share-requests/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("collab.requests.title")}
        subtitle={t("collab.requests.subtitle")}
        icon={<Building2 size={18} className="text-brand" />}
        actions={
          <Button onClick={() => setNewOpen(true)} size="md" variant="primary">
            <Plus size={15} className="mr-1.5" />
            {t("collab.requests.new")}
          </Button>
        }
      />

      <div className="flex items-center gap-1 border-b border-border/60">
        <TabButton
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
          label={t("collab.requests.outgoing")}
          count={outgoing.data?.items?.length ?? 0}
        />
        <TabButton
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          label={t("collab.requests.incoming")}
          count={incoming.data?.items?.length ?? 0}
        />
      </div>

      <Card padding={false} className="overflow-hidden">
        {data.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty
            title={
              tab === "outgoing"
                ? t("collab.requests.noOutgoing")
                : t("collab.requests.noIncoming")
            }
            description={t("collab.requests.subtitle")}
            icon={<Building2 size={22} className="text-text-muted" />}
            className="py-12"
          />
        ) : (
          <div className="px-1 pb-1">
            <Table className="border-0 rounded-none shadow-none">
              <THead>
                <TR>
                  <TH>{tab === "outgoing" ? "Target hospital" : "Requester"}</TH>
                  <TH>{t("common.name")}</TH>
                  <TH>{t("collab.requests.form.scope")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>Expires</TH>
                  <TH className="text-right">{t("common.actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((r: any) => (
                  <TR key={r.req.id} className="group">
                    <TD className="font-medium">
                      {(tab === "outgoing" ? r.source : r.requester)?.name ?? "—"}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="hospital-patient-avatar">
                          {(r.user?.name ?? "?")
                            .split(" ")
                            .slice(0, 2)
                            .map((s: string) => s[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <span>{r.user?.name ?? "—"}</span>
                      </div>
                    </TD>
                    <TD>
                      <Pill tone={SCOPE_TONE[r.req.scope] ?? "neutral"} className="text-[11px]">
                        {r.req.scope}
                      </Pill>
                    </TD>
                    <TD>
                      <Pill tone={STATUS_TONE[r.req.status] ?? "neutral"} className="text-[11px]">
                        {t(`collab.requests.status.${r.req.status}`)}
                      </Pill>
                    </TD>
                    <TD className="text-xs text-text-muted whitespace-nowrap">
                      {r.req.expiresAt
                        ? formatDate(r.req.expiresAt, locale)
                        : "—"}
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {tab === "incoming" && r.req.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => approve.mutate(r.req.id)}
                              disabled={approve.isPending}
                            >
                              {t("collab.requests.actions.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const reason = window.prompt(
                                  "Decline reason (optional):"
                                );
                                if (reason === null) return;
                                decline.mutate({ id: r.req.id, reason });
                              }}
                              disabled={decline.isPending}
                            >
                              <XCircle size={13} className="mr-1" />
                              {t("collab.requests.actions.decline")}
                            </Button>
                          </>
                        ) : null}
                        <Link
                          href={`/hospital/collab/requests/${r.req.id}`}
                          className="portal-btn portal-btn-ghost portal-btn-sm opacity-70 group-hover:opacity-100"
                        >
                          Open
                          <ArrowRight size={13} />
                        </Link>
                        {tab === "incoming" && r.req.status === "approved" ? (
                          <button
                            type="button"
                            onClick={() => revoke.mutate(r.req.id)}
                            disabled={revoke.isPending}
                            className="portal-btn portal-btn-ghost portal-btn-sm text-danger"
                          >
                            {t("collab.requests.actions.revoke")}
                          </button>
                        ) : null}
                        {tab === "outgoing" &&
                        (r.req.status === "approved" || r.req.status === "pending") ? (
                          <button
                            type="button"
                            onClick={() => revoke.mutate(r.req.id)}
                            disabled={revoke.isPending}
                            className="portal-btn portal-btn-ghost portal-btn-sm text-danger"
                          >
                            {t("collab.requests.actions.revoke")}
                          </button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      <NewRequestModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-brand text-text"
          : "border-transparent text-text-muted hover:text-text"
      )}
    >
      {label}
      {count > 0 ? (
        <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-surface-2 text-[10px] font-semibold">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function NewRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [sourceHospitalId, setSourceHospitalId] = useState("");
  const [scope, setScope] = useState("full");
  const [reason, setReason] = useState("");
  const [ttl, setTtl] = useState(24);
  const [submitting, setSubmitting] = useState(false);

  const [patientSearch, setPatientSearch] = useState("");

  const patientsQ = useQuery({
    queryKey: [
      "hospital-share-requests",
      "source-patients",
      { source: sourceHospitalId, q: patientSearch },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("sourceHospitalId", sourceHospitalId);
      if (patientSearch.trim()) params.set("q", patientSearch.trim());
      return api<{ patients: any[] }>(
        `/hospital-share-requests/source-patients?${params}`
      );
    },
    enabled: !!sourceHospitalId && open,
  });
  const hospitalsQ = useQuery({
    queryKey: ["hospitals", "list"],
    queryFn: () => api<{ hospitals: any[] }>("/hospitals"),
    enabled: open,
  });

  const reset = () => {
    setPatientId("");
    setSourceHospitalId("");
    setPatientSearch("");
    setScope("full");
    setReason("");
    setTtl(24);
  };

  const submit = async () => {
    if (!sourceHospitalId || !patientId || !reason.trim()) {
      toast.error("All fields required");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/hospital-share-requests`, {
        method: "POST",
        json: {
          sourceHospitalId,
          patientId,
          scope,
          reason: reason.trim(),
          ttlHours: ttl,
        },
      });
      toast.success("Request sent");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
      reset();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("collab.requests.new")}
      subtitle={t("collab.requests.subtitle")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={submitting}
          >
            <Send size={14} className="mr-1.5" />
            {t("collab.requests.form.submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("collab.requests.form.sourceHospital")}>
          <select
            value={sourceHospitalId}
            onChange={(e) => {
              setSourceHospitalId(e.target.value);
              setPatientId("");
              setPatientSearch("");
            }}
            className="portal-input w-full"
          >
            <option value="">Select hospital…</option>
            {hospitalsQ.data?.hospitals
              ?.filter((h: any) => h.id !== useAuthStore.getState().activeHospitalId)
              .map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label={t("collab.requests.form.patient")}>
          <input
            type="search"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            disabled={!sourceHospitalId}
            placeholder="Search by name, MRN, or phone…"
            className="portal-input w-full mb-2"
          />
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            disabled={!sourceHospitalId || patientsQ.isLoading}
            className="portal-input w-full"
          >
            <option value="">Select patient…</option>
            {patientsQ.data?.patients?.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.mrn ? `(${p.mrn})` : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-text-muted mt-1">
            Only patients registered at the selected hospital appear here.
          </p>
        </Field>

        <Field label={t("collab.requests.form.scope")}>
          <div className="flex flex-wrap gap-2">
            {(["full", "records", "prescriptions", "lab"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium border transition-colors",
                  scope === s
                    ? "bg-brand text-white border-brand"
                    : "bg-surface-2 text-text-muted border-border hover:text-text"
                )}
              >
                {t(`collab.requests.form.scope${s.charAt(0).toUpperCase() + s.slice(1)}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t("collab.requests.form.ttl")}>
          <div className="flex gap-2">
            {[24, 72, 168].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setTtl(h)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium border transition-colors",
                  ttl === h
                    ? "bg-brand text-white border-brand"
                    : "bg-surface-2 text-text-muted border-border hover:text-text"
                )}
              >
                {t(
                  h === 24
                    ? "collab.requests.form.ttl24"
                    : h === 72
                    ? "collab.requests.form.ttl72"
                    : "collab.requests.form.ttl168"
                )}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t("collab.requests.form.reason")}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("collab.requests.form.reasonPlaceholder")}
            rows={3}
            className="portal-input w-full"
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
