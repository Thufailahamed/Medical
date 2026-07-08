"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Send } from "lucide-react";
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
  accepted: "success",
  declined: "danger",
  completed: "success",
  cancelled: "neutral",
};

const URGENCY_TONE: Record<string, "info" | "warn" | "danger" | "neutral"> = {
  routine: "info",
  urgent: "warn",
  emergency: "danger",
};

export default function ReferralsPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("outgoing");
  const [newOpen, setNewOpen] = useState(false);

  const outgoing = useQuery({
    queryKey: ["cross-hospital-referrals", "outgoing"],
    queryFn: () => api<{ items: any[] }>("/cross-hospital-referrals/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["cross-hospital-referrals", "incoming"],
    queryFn: () => api<{ items: any[] }>("/cross-hospital-referrals/incoming"),
    refetchInterval: 30_000,
  });

  const items = (tab === "outgoing" ? outgoing : incoming).data?.items ?? [];

  const accept = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-referrals/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Accepted");
      qc.invalidateQueries({ queryKey: ["cross-hospital-referrals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const decline = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-referrals/${id}/decline`, {
        method: "POST",
        json: { reason: "" },
      }),
    onSuccess: () => {
      toast.success("Declined");
      qc.invalidateQueries({ queryKey: ["cross-hospital-referrals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const complete = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-referrals/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Marked complete");
      qc.invalidateQueries({ queryKey: ["cross-hospital-referrals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("collab.referrals.title")}
        subtitle={t("collab.subtitle")}
        icon={<Building2 size={18} className="text-brand" />}
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Plus size={15} className="mr-1.5" />
            {t("collab.referrals.new")}
          </Button>
        }
      />

      <div className="flex items-center gap-1 border-b border-border/60">
        <TabBtn
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
          label={t("collab.referrals.outgoing")}
          count={outgoing.data?.items?.length ?? 0}
        />
        <TabBtn
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          label={t("collab.referrals.incoming")}
          count={incoming.data?.items?.length ?? 0}
        />
      </div>

      <Card padding={false} className="overflow-hidden">
        {items.length === 0 ? (
          <Empty
            title={
              tab === "outgoing"
                ? t("collab.referrals.noOutgoing")
                : t("collab.referrals.noIncoming")
            }
            description={t("collab.subtitle")}
            className="py-12"
          />
        ) : (
          <Table className="border-0 rounded-none shadow-none">
            <THead>
              <TR>
                <TH>{tab === "outgoing" ? "To" : "From"}</TH>
                <TH>{t("common.name")}</TH>
                <TH>Specialty</TH>
                <TH>Urgency</TH>
                <TH>{t("common.status")}</TH>
                <TH>Sent</TH>
                <TH className="text-right">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r: any) => (
                <TR key={r.ref.id}>
                  <TD className="font-medium">
                    {(tab === "outgoing" ? r.to : r.from)?.name ?? "—"}
                  </TD>
                  <TD>{r.user?.name ?? "—"}</TD>
                  <TD>{r.ref.toSpecialty}</TD>
                  <TD>
                    <Pill tone={URGENCY_TONE[r.ref.urgency] ?? "neutral"} className="text-[11px]">
                      {r.ref.urgency}
                    </Pill>
                  </TD>
                  <TD>
                    <Pill tone={STATUS_TONE[r.ref.status] ?? "neutral"} className="text-[11px]">
                      {t(`collab.referrals.status.${r.ref.status}`)}
                    </Pill>
                  </TD>
                  <TD className="text-xs text-text-muted whitespace-nowrap">
                    {formatDate(r.ref.createdAt, locale)}
                  </TD>
                  <TD className="text-right">
                    {tab === "incoming" && r.ref.status === "pending" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => accept.mutate(r.ref.id)}
                          disabled={accept.isPending}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => decline.mutate(r.ref.id)}
                          disabled={decline.isPending}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : null}
                    {r.ref.status === "accepted" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => complete.mutate(r.ref.id)}
                        disabled={complete.isPending}
                      >
                        Mark complete
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <NewReferralModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function TabBtn({
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
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
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

function NewReferralModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [toHospitalId, setToHospitalId] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [urgency, setUrgency] = useState("routine");
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const patientsQ = useQuery({
    queryKey: ["hospital-portal", "patients", { forReferral: true }],
    queryFn: () => api<{ patients: any[] }>("/hospital-portal/patients?status=registered"),
    enabled: open,
  });
  const hospitalsQ = useQuery({
    queryKey: ["hospitals", "list"],
    queryFn: () => api<{ hospitals: any[] }>("/hospitals"),
    enabled: open,
  });

  const submit = async () => {
    if (!patientId || !toHospitalId || !specialty || !reason.trim() || !summary.trim()) {
      toast.error("All fields required");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/cross-hospital-referrals`, {
        method: "POST",
        json: {
          patientId,
          toHospitalId,
          toSpecialty: specialty.trim(),
          reason: reason.trim(),
          clinicalSummary: summary.trim(),
          urgency,
        },
      });
      toast.success("Referral sent");
      qc.invalidateQueries({ queryKey: ["cross-hospital-referrals"] });
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
      title={t("collab.referrals.new")}
      subtitle={t("collab.subtitle")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            <Send size={14} className="mr-1.5" />
            {t("collab.referrals.form.submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("collab.referrals.form.patient")}>
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="portal-input w-full"
          >
            <option value="">Select patient…</option>
            {patientsQ.data?.patients?.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.mrn ? `(${p.mrn})` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("collab.referrals.form.toHospital")}>
          <select
            value={toHospitalId}
            onChange={(e) => setToHospitalId(e.target.value)}
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

        <Field label={t("collab.referrals.form.specialty")}>
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="portal-input w-full"
            placeholder="e.g. Cardiology"
          />
        </Field>

        <Field label={t("collab.referrals.form.urgency")}>
          <div className="flex gap-2">
            {(["routine", "urgent", "emergency"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium border",
                  urgency === u
                    ? "bg-brand text-white border-brand"
                    : "bg-surface-2 text-text-muted border-border"
                )}
              >
                {t(`collab.referrals.form.urgency${u.charAt(0).toUpperCase() + u.slice(1)}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t("collab.referrals.form.reason")}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="portal-input w-full"
          />
        </Field>

        <Field label={t("collab.referrals.form.summary")}>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
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
