"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Plus,
  RefreshCw,
  Send,
  Share2,
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
  approved: TONE_BADGE.emerald,
  declined: TONE_BADGE.rose,
  expired: TONE_BADGE.slate,
  revoked: TONE_BADGE.slate,
};

const STATUS_RAIL: Record<string, "amber" | "emerald" | "rose" | "slate"> = {
  pending: "amber",
  approved: "emerald",
  declined: "rose",
  expired: "slate",
  revoked: "slate",
};

interface ShareRequest {
  id: string;
  status: string;
  scope: string;
  expiresAt?: string | null;
  createdAt: string;
}
interface RequestItem {
  req: ShareRequest;
  source?: { id: string; name: string } | null;
  requester?: { id: string; name: string } | null;
  user?: { name?: string } | null;
}

export default function CollabRequestsPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("outgoing");
  const [newOpen, setNewOpen] = useState(false);

  const outgoing = useQuery({
    queryKey: ["hospital-share-requests", "outgoing"],
    queryFn: () => api<{ items: RequestItem[] }>("/hospital-share-requests/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["hospital-share-requests", "incoming"],
    queryFn: () => api<{ items: RequestItem[] }>("/hospital-share-requests/incoming"),
    refetchInterval: 30_000,
  });

  const data = tab === "outgoing" ? outgoing : incoming;
  const items = data.data?.items ?? [];

  const outItems = outgoing.data?.items ?? [];
  const inItems = incoming.data?.items ?? [];
  const pendingIn = inItems.filter((r) => r.req.status === "pending").length;
  const approvedCount = [...outItems, ...inItems].filter((r) => r.req.status === "approved").length;

  const approve = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-share-requests/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
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
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-share-requests/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: ["hospital-share-requests"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const hero = (
    <DoctorHero
      kickerIcon={<Share2 size={13} aria-hidden />}
      kicker={t("nav.collab")}
      kickerMeta={t("collab.tabs.requests")}
      title={
        <>
          {t("collab.requests.title")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · chart access
          </span>
        </>
      }
      description={t("collab.requests.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Send size={12} className="text-sky-300" />
            {outItems.length} {t("collab.requests.outgoing").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <Inbox size={12} className="text-amber-300" />
            {pendingIn} {t("collab.requests.incoming").toLowerCase()} pending
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<Inbox size={18} />}
          label={t("collab.requests.incoming")}
          value={incoming.isLoading ? "…" : pendingIn}
          sub={pendingIn > 0 ? "Awaiting your approval" : "Nothing pending"}
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
            {t("collab.requests.new")}
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
          icon={<Send size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("collab.requests.outgoing")}
          value={outgoing.isLoading ? "…" : String(outItems.length)}
          sub="Requested by us"
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
        />
        <StatTile
          icon={<Inbox size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("collab.requests.incoming")}
          value={incoming.isLoading ? "…" : String(inItems.length)}
          sub={`${pendingIn} pending`}
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          pulse={pendingIn > 0}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("collab.requests.status.approved")}
          value={String(approvedCount)}
          sub="Active shares"
        />
        <StatTile
          icon={<ArrowRight size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("collab.tabs.referrals")}
          value="→"
          sub={t("collab.subtitle")}
          href="/hospital/collab/referrals"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<Building2 size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("collab.requests.title")}
            caption={data.isLoading ? t("common.loading") : `${items.length}`}
          />
          <div className="mt-4">
            <Segmented<Tab>
              ariaLabel="Request direction"
              value={tab}
              onChange={setTab}
              options={[
                { value: "outgoing", label: t("collab.requests.outgoing"), count: outItems.length },
                { value: "incoming", label: t("collab.requests.incoming"), count: inItems.length },
              ]}
            />
          </div>

          {data.isLoading ? (
            <PanelSkeleton rows={5} className="mt-4" />
          ) : items.length === 0 ? (
            <EmptyBlock
              icon={<Building2 size={19} />}
              title={tab === "outgoing" ? t("collab.requests.noOutgoing") : t("collab.requests.noIncoming")}
              body={t("collab.requests.subtitle")}
              actions={
                <button type="button" onClick={() => setNewOpen(true)} className={PRIMARY_BTN}>
                  <Plus size={13} /> {t("collab.requests.new")}
                </button>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((r) => {
                const hospital = (tab === "outgoing" ? r.source : r.requester)?.name ?? "—";
                const initials = (r.user?.name ?? "?")
                  .split(" ")
                  .slice(0, 2)
                  .map((s) => s[0])
                  .join("")
                  .toUpperCase();
                const showApprove = tab === "incoming" && r.req.status === "pending";
                const showRevoke =
                  (tab === "incoming" && r.req.status === "approved") ||
                  (tab === "outgoing" && (r.req.status === "approved" || r.req.status === "pending"));
                return (
                  <li key={r.req.id}>
                    <RailRow
                      tone={STATUS_RAIL[r.req.status] ?? "slate"}
                      active={r.req.status === "pending"}
                      icon={<Building2 size={16} />}
                      title={
                        <>
                          {hospital}{" "}
                          <span className="text-xs font-medium text-slate-400">· {r.user?.name ?? "—"}</span>
                        </>
                      }
                      meta={
                        <>
                          <span className="mr-2 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                            {r.req.scope}
                          </span>
                          {initials !== "?" ? `${t("common.name")}: ${r.user?.name} · ` : ""}
                          {r.req.expiresAt ? `exp ${formatDate(r.req.expiresAt, locale)}` : t("common.date")}
                        </>
                      }
                      trailing={
                        <>
                          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_BADGE[r.req.status] ?? TONE_BADGE.slate)}>
                            {t(`collab.requests.status.${r.req.status}`)}
                          </span>
                          {showApprove ? (
                            <>
                              <button
                                type="button"
                                onClick={() => approve.mutate(r.req.id)}
                                disabled={approve.isPending}
                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <CheckCircle2 size={13} aria-hidden />
                                {t("collab.requests.actions.approve")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const reason = window.prompt("Decline reason (optional):");
                                  if (reason === null) return;
                                  decline.mutate({ id: r.req.id, reason });
                                }}
                                disabled={decline.isPending}
                                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                              >
                                <XCircle size={13} aria-hidden />
                                {t("collab.requests.actions.decline")}
                              </button>
                            </>
                          ) : null}
                          <Link
                            href={`/hospital/collab/requests/${r.req.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                          >
                            {t("patients.actions.view")}
                            <ArrowRight size={13} aria-hidden />
                          </Link>
                          {showRevoke ? (
                            <button
                              type="button"
                              onClick={() => revoke.mutate(r.req.id)}
                              disabled={revoke.isPending}
                              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              {t("collab.requests.actions.revoke")}
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
            id="collab-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: Share2, label: t("collab.tabs.referrals"), hint: "Cross-hospital", href: "/hospital/collab/referrals", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: FileText, label: t("collab.tabs.lab"), hint: "Outsource tests", href: "/hospital/collab/lab-routing", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { icon: Clock, label: t("collab.tabs.consults"), hint: "Expert advice", href: "/hospital/collab/consults", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
            ]}
          />
        </aside>
      </div>

      <NewRequestModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
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
      return api<{ patients: { id: string; name: string; mrn?: string }[] }>(
        `/hospital-share-requests/source-patients?${params}`
      );
    },
    enabled: !!sourceHospitalId && open,
  });
  const hospitalsQ = useQuery({
    queryKey: ["hospitals", "list"],
    queryFn: () => api<{ hospitals: { id: string; name: string }[] }>("/hospitals"),
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
      title={t("collab.requests.new")}
      subtitle={t("collab.requests.subtitle")}
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
            {t("collab.requests.form.submit")}
          </button>
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

        <Field label={t("collab.requests.form.patient")}>
          <input
            type="search"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            disabled={!sourceHospitalId}
            placeholder="Search by name, MRN, or phone…"
            className={cn(FIELD_INPUT, "mb-2")}
          />
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            disabled={!sourceHospitalId || patientsQ.isLoading}
            className={FIELD_INPUT}
          >
            <option value="">Select patient…</option>
            {patientsQ.data?.patients?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.mrn ? `(${p.mrn})` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">
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
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  scope === s
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-[color:var(--ink-border)] bg-slate-50 text-slate-500 hover:text-slate-800"
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
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  ttl === h
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-[color:var(--ink-border)] bg-slate-50 text-slate-500 hover:text-slate-800"
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
