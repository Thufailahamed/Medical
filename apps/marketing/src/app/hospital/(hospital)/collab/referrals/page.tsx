"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Inbox,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Modal } from "@/portal/components/ui/Modal";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatDate } from "@/hospital/lib/format";
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
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  HeroPulse,
  PanelSkeleton,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type Tab = "outgoing" | "incoming";

const STATUS_BADGE: Record<string, string> = {
  pending: TONE_BADGE.amber,
  accepted: TONE_BADGE.emerald,
  declined: TONE_BADGE.rose,
  completed: TONE_BADGE.emerald,
  cancelled: TONE_BADGE.slate,
};

const STATUS_RAIL: Record<string, "amber" | "emerald" | "rose" | "sky" | "slate"> = {
  pending: "amber",
  accepted: "emerald",
  declined: "rose",
  completed: "emerald",
  cancelled: "slate",
};

const URGENCY_BADGE: Record<string, string> = {
  routine: TONE_BADGE.sky,
  urgent: TONE_BADGE.amber,
  emergency: TONE_BADGE.rose,
};

interface Referral {
  id: string;
  status: string;
  urgency: string;
  toSpecialty: string;
  reason?: string;
  createdAt: string;
}
interface ReferralItem {
  ref: Referral;
  to?: { id: string; name: string } | null;
  from?: { id: string; name: string } | null;
  user?: { name?: string } | null;
}

export default function ReferralsPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("outgoing");
  const [newOpen, setNewOpen] = useState(false);

  const outgoing = useQuery({
    queryKey: ["cross-hospital-referrals", "outgoing"],
    queryFn: () => api<{ items: ReferralItem[] }>("/cross-hospital-referrals/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["cross-hospital-referrals", "incoming"],
    queryFn: () => api<{ items: ReferralItem[] }>("/cross-hospital-referrals/incoming"),
    refetchInterval: 30_000,
  });

  const data = tab === "outgoing" ? outgoing : incoming;
  const items = data.data?.items ?? [];

  const outItems = outgoing.data?.items ?? [];
  const inItems = incoming.data?.items ?? [];
  const pendingIn = inItems.filter((r) => r.ref.status === "pending").length;
  const urgentCount = [...outItems, ...inItems].filter(
    (r) => r.ref.urgency === "emergency" && (r.ref.status === "pending" || r.ref.status === "accepted")
  ).length;
  const completedCount = [...outItems, ...inItems].filter((r) => r.ref.status === "completed").length;

  const accept = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-referrals/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Accepted");
      qc.invalidateQueries({ queryKey: ["cross-hospital-referrals"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
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
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });
  const complete = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-referrals/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Marked complete");
      qc.invalidateQueries({ queryKey: ["cross-hospital-referrals"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <DoctorHero
        kickerIcon={<Share2 size={13} aria-hidden />}
        kicker={t("nav.collab")}
        kickerMeta={t("collab.tabs.referrals")}
        title={
          <>
            {t("collab.referrals.title")}{" "}
            <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
              · cross-hospital
            </span>
          </>
        }
        description={t("collab.subtitle")}
        chips={
          <>
            <span className={HERO_CHIP}>
              <Send size={12} className="text-sky-300" />
              {outItems.length} {t("collab.referrals.outgoing").toLowerCase()}
            </span>
            <span className={HERO_CHIP}>
              <Inbox size={12} className="text-amber-300" />
              {pendingIn} pending
            </span>
            {urgentCount > 0 ? (
              <span className={cn(HERO_CHIP, "border-rose-300/40 bg-rose-500/15 text-rose-100")}>
                <Stethoscope size={12} className="text-rose-300" />
                {urgentCount} emergency
              </span>
            ) : null}
          </>
        }
        aside={
          <HeroPulse
            icon={<Inbox size={18} />}
            label={t("collab.referrals.incoming")}
            value={incoming.isLoading ? "…" : pendingIn}
            sub={pendingIn > 0 ? "Awaiting your response" : "Nothing pending"}
          />
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                outgoing.refetch();
                incoming.refetch();
              }}
              className={HERO_GHOST}
            >
              <RefreshCw size={13} className={outgoing.isFetching || incoming.isFetching ? "animate-spin" : ""} />
              {t("common.refresh")}
            </button>
            <button type="button" onClick={() => setNewOpen(true)} className={HERO_PRIMARY}>
              <Plus size={14} className="text-emerald-600" />
              {t("collab.referrals.new")}
            </button>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Send size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("collab.referrals.outgoing")}
          value={outgoing.isLoading ? "…" : String(outItems.length)}
          sub="Sent by us"
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
        />
        <StatTile
          icon={<Inbox size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("collab.referrals.incoming")}
          value={incoming.isLoading ? "…" : String(inItems.length)}
          sub={`${pendingIn} pending`}
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          pulse={pendingIn > 0}
        />
        <StatTile
          icon={<Stethoscope size={16} />}
          tone="bg-rose-50 text-rose-600"
          label="Emergency"
          value={String(urgentCount)}
          sub="Active urgent cases"
          pulse={urgentCount > 0}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("collab.referrals.status.completed")}
          value={String(completedCount)}
          sub="Closed referrals"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<Building2 size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("collab.referrals.title")}
            caption={data.isLoading ? t("common.loading") : `${items.length}`}
          />
          <div className="mt-4">
            <Segmented<Tab>
              ariaLabel="Referral direction"
              value={tab}
              onChange={setTab}
              options={[
                { value: "outgoing", label: t("collab.referrals.outgoing"), count: outItems.length },
                { value: "incoming", label: t("collab.referrals.incoming"), count: inItems.length },
              ]}
            />
          </div>

          {data.isLoading ? (
            <PanelSkeleton rows={5} className="mt-4" />
          ) : items.length === 0 ? (
            <EmptyBlock
              icon={<Share2 size={19} />}
              title={tab === "outgoing" ? t("collab.referrals.noOutgoing") : t("collab.referrals.noIncoming")}
              body={t("collab.subtitle")}
              actions={
                <button type="button" onClick={() => setNewOpen(true)} className={PRIMARY_BTN}>
                  <Plus size={13} /> {t("collab.referrals.new")}
                </button>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((r) => {
                const hospital = (tab === "outgoing" ? r.to : r.from)?.name ?? "—";
                const showRespond = tab === "incoming" && r.ref.status === "pending";
                const showComplete = r.ref.status === "accepted";
                return (
                  <li key={r.ref.id}>
                    <RailRow
                      tone={STATUS_RAIL[r.ref.status] ?? "slate"}
                      active={r.ref.status === "pending"}
                      icon={<Stethoscope size={16} />}
                      title={
                        <>
                          {hospital}{" "}
                          <span className="text-xs font-medium text-slate-400">
                            · {r.user?.name ?? "—"} · {r.ref.toSpecialty}
                          </span>
                        </>
                      }
                      meta={formatDate(r.ref.createdAt, locale)}
                      trailing={
                        <>
                          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", URGENCY_BADGE[r.ref.urgency] ?? TONE_BADGE.slate)}>
                            {r.ref.urgency}
                          </span>
                          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_BADGE[r.ref.status] ?? TONE_BADGE.slate)}>
                            {t(`collab.referrals.status.${r.ref.status}`)}
                          </span>
                          {showRespond ? (
                            <>
                              <button
                                type="button"
                                onClick={() => accept.mutate(r.ref.id)}
                                disabled={accept.isPending}
                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <CheckCircle2 size={13} aria-hidden />
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => decline.mutate(r.ref.id)}
                                disabled={decline.isPending}
                                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                              >
                                <XCircle size={13} aria-hidden />
                                Decline
                              </button>
                            </>
                          ) : null}
                          {showComplete ? (
                            <button
                              type="button"
                              onClick={() => complete.mutate(r.ref.id)}
                              disabled={complete.isPending}
                              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                            >
                              Mark complete
                            </button>
                          ) : null}
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="referral-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: FileText, label: t("collab.tabs.requests"), hint: "Chart access", href: "/hospital/collab/requests", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: MessageSquare, label: t("collab.tabs.consults"), hint: "Expert advice", href: "/hospital/collab/consults", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
              { icon: ArrowRight, label: t("collab.tabs.discharges"), hint: "Handoffs", href: "/hospital/collab/discharges", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
            ]}
          />
        </aside>
      </div>

      <NewReferralModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
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
    queryFn: () => api<{ patients: { id: string; name: string; mrn?: string }[] }>("/hospital-portal/patients?status=registered"),
    enabled: open,
  });
  const hospitalsQ = useQuery({
    queryKey: ["hospitals", "list"],
    queryFn: () => api<{ hospitals: { id: string; name: string }[] }>("/hospitals"),
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
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed");
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
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-[color:var(--ink-border)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send size={14} />
            {t("collab.referrals.form.submit")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("collab.referrals.form.patient")}>
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className={FIELD_INPUT}
          >
            <option value="">Select patient…</option>
            {patientsQ.data?.patients?.map((p) => (
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
            className={FIELD_INPUT}
          >
            <option value="">Select hospital…</option>
            {hospitalsQ.data?.hospitals
              ?.filter((h) => h.id !== useAuthStore.getState().activeHospitalId)
              .map((h) => (
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
            className={FIELD_INPUT}
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
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  urgency === u
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-[color:var(--ink-border)] bg-slate-50 text-slate-500 hover:text-slate-800"
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
            className={FIELD_TEXTAREA}
          />
        </Field>

        <Field label={t("collab.referrals.form.summary")}>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className={FIELD_TEXTAREA}
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={FIELD_LABEL}>{label}</label>
      {children}
    </div>
  );
}
