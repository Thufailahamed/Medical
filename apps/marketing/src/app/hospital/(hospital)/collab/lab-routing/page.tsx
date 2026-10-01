"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Beaker,
  Building2,
  CheckCircle2,
  FileText,
  FlaskConical,
  Inbox,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
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
  accepted: TONE_BADGE.sky,
  completed: TONE_BADGE.emerald,
  cancelled: TONE_BADGE.slate,
};

const STATUS_RAIL: Record<string, "amber" | "emerald" | "sky" | "slate"> = {
  pending: "amber",
  accepted: "sky",
  completed: "emerald",
  cancelled: "slate",
};

interface Routing {
  id: string;
  status: string;
  reason?: string;
  createdAt: string;
}
interface LabOrder {
  id: string;
  tests?: string[];
  patientId?: string;
}
interface RoutingItem {
  routing: Routing;
  to?: { id: string; name: string } | null;
  from?: { id: string; name: string } | null;
  order?: LabOrder | null;
}

export default function LabRoutingPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("outgoing");
  const [newOpen, setNewOpen] = useState(false);

  const outgoing = useQuery({
    queryKey: ["cross-hospital-lab-routings", "outgoing"],
    queryFn: () => api<{ items: RoutingItem[] }>("/cross-hospital-lab-routings/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["cross-hospital-lab-routings", "incoming"],
    queryFn: () => api<{ items: RoutingItem[] }>("/cross-hospital-lab-routings/incoming"),
    refetchInterval: 30_000,
  });

  const data = tab === "outgoing" ? outgoing : incoming;
  const items = data.data?.items ?? [];

  const outItems = outgoing.data?.items ?? [];
  const inItems = incoming.data?.items ?? [];
  const pendingIn = inItems.filter((r) => r.routing.status === "pending").length;
  const inProgress =
    inItems.filter((r) => r.routing.status === "accepted").length +
    outItems.filter((r) => r.routing.status === "accepted").length;
  const completedCount = [...outItems, ...inItems].filter((r) => r.routing.status === "completed").length;

  const accept = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-lab-routings/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Accepted");
      qc.invalidateQueries({ queryKey: ["cross-hospital-lab-routings"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });
  const complete = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-lab-routings/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Completed");
      qc.invalidateQueries({ queryKey: ["cross-hospital-lab-routings"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-lab-routings/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["cross-hospital-lab-routings"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <DoctorHero
        kickerIcon={<Building2 size={13} aria-hidden />}
        kicker={t("nav.collab")}
        kickerMeta={t("collab.tabs.lab")}
        title={
          <>
            {t("collab.labRouting.title")}{" "}
            <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
              · outsourced
            </span>
          </>
        }
        description={t("collab.subtitle")}
        chips={
          <>
            <span className={HERO_CHIP}>
              <Send size={12} className="text-sky-300" />
              {outItems.length} {t("collab.labRouting.outgoing").toLowerCase()}
            </span>
            <span className={HERO_CHIP}>
              <Inbox size={12} className="text-amber-300" />
              {pendingIn} pending
            </span>
          </>
        }
        aside={
          <HeroPulse
            icon={<FlaskConical size={18} />}
            label="In progress"
            value={incoming.isLoading || outgoing.isLoading ? "…" : inProgress}
            sub={pendingIn > 0 ? `${pendingIn} incoming pending` : "All caught up"}
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
              {t("collab.labRouting.new")}
            </button>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Send size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("collab.labRouting.outgoing")}
          value={outgoing.isLoading ? "…" : String(outItems.length)}
          sub="Routed to partners"
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
        />
        <StatTile
          icon={<Inbox size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("collab.labRouting.incoming")}
          value={incoming.isLoading ? "…" : String(inItems.length)}
          sub={`${pendingIn} pending`}
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          pulse={pendingIn > 0}
        />
        <StatTile
          icon={<Beaker size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="In progress"
          value={String(inProgress)}
          sub="Accepted routings"
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("collab.labRouting.status.completed")}
          value={String(completedCount)}
          sub="Results returned"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<FlaskConical size={16} />}
            tone="bg-violet-50 text-violet-600"
            title={t("collab.labRouting.title")}
            caption={data.isLoading ? t("common.loading") : `${items.length}`}
          />
          <div className="mt-4">
            <Segmented<Tab>
              ariaLabel="Routing direction"
              value={tab}
              onChange={setTab}
              options={[
                { value: "outgoing", label: t("collab.labRouting.outgoing"), count: outItems.length },
                { value: "incoming", label: t("collab.labRouting.incoming"), count: inItems.length },
              ]}
            />
          </div>

          {data.isLoading ? (
            <PanelSkeleton rows={5} className="mt-4" />
          ) : items.length === 0 ? (
            <EmptyBlock
              icon={<Beaker size={19} />}
              title={tab === "outgoing" ? t("collab.labRouting.noOutgoing") : t("collab.labRouting.noIncoming")}
              body={t("collab.subtitle")}
              actions={
                <button type="button" onClick={() => setNewOpen(true)} className={PRIMARY_BTN}>
                  <Plus size={13} /> {t("collab.labRouting.new")}
                </button>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((r) => {
                const hospital = (tab === "outgoing" ? r.to : r.from)?.name ?? "—";
                const tests = Array.isArray(r.order?.tests) ? r.order.tests.join(", ") : "—";
                const showAccept = tab === "incoming" && r.routing.status === "pending";
                const showComplete = tab === "incoming" && r.routing.status === "accepted";
                const showCancel =
                  tab === "outgoing" &&
                  (r.routing.status === "pending" || r.routing.status === "accepted");
                return (
                  <li key={r.routing.id}>
                    <RailRow
                      tone={STATUS_RAIL[r.routing.status] ?? "slate"}
                      active={r.routing.status === "pending"}
                      icon={<FlaskConical size={16} />}
                      title={
                        <>
                          {hospital}{" "}
                          <span className="text-xs font-medium text-slate-400">· {tests}</span>
                        </>
                      }
                      meta={`${r.routing.reason ?? "—"} · ${formatDate(r.routing.createdAt, locale)}`}
                      trailing={
                        <>
                          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_BADGE[r.routing.status] ?? TONE_BADGE.slate)}>
                            {t(`collab.labRouting.status.${r.routing.status}`)}
                          </span>
                          {showAccept ? (
                            <button
                              type="button"
                              onClick={() => accept.mutate(r.routing.id)}
                              disabled={accept.isPending}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} aria-hidden />
                              Accept
                            </button>
                          ) : null}
                          {showComplete ? (
                            <button
                              type="button"
                              onClick={() => complete.mutate(r.routing.id)}
                              disabled={complete.isPending}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Mark complete
                            </button>
                          ) : null}
                          {showCancel ? (
                            <button
                              type="button"
                              onClick={() => cancel.mutate(r.routing.id)}
                              disabled={cancel.isPending}
                              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              <XCircle size={13} aria-hidden />
                              Cancel
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
            id="lab-routing-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: FlaskConical, label: t("nav.lab"), hint: "Internal queue", href: "/hospital/lab", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { icon: FileText, label: t("collab.tabs.requests"), hint: "Chart access", href: "/hospital/collab/requests", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: MessageSquare, label: t("collab.tabs.consults"), hint: "Expert advice", href: "/hospital/collab/consults", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
            ]}
          />
        </aside>
      </div>

      <NewRoutingModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function NewRoutingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [labOrderId, setLabOrderId] = useState("");
  const [toHospitalId, setToHospitalId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ordersQ = useQuery({
    queryKey: ["hospital-portal", "lab-orders", "routable"],
    queryFn: () =>
      api<{ orders: { id: string; tests?: string[] }[] }>(
        "/hospital-portal/lab-orders?status=ordered,sample_collected,in_progress"
      ),
    enabled: open,
  });
  const hospitalsQ = useQuery({
    queryKey: ["hospitals", "list"],
    queryFn: () => api<{ hospitals: { id: string; name: string }[] }>("/hospitals"),
    enabled: open,
  });

  const submit = async () => {
    if (!labOrderId || !toHospitalId || !reason.trim()) {
      toast.error("All fields required");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/cross-hospital-lab-routings`, {
        method: "POST",
        json: { labOrderId, toHospitalId, reason: reason.trim() },
      });
      toast.success("Lab order routed");
      qc.invalidateQueries({ queryKey: ["cross-hospital-lab-routings"] });
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
      title={t("collab.labRouting.new")}
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
            {t("collab.labRouting.form.submit")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("collab.labRouting.form.labOrder")}>
          <select
            value={labOrderId}
            onChange={(e) => setLabOrderId(e.target.value)}
            className={FIELD_INPUT}
          >
            <option value="">Select lab order…</option>
            {ordersQ.data?.orders?.map((o) => (
              <option key={o.id} value={o.id}>
                {(Array.isArray(o.tests) ? o.tests.join(", ") : o.tests ?? "Lab order").slice(0, 80)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("collab.labRouting.form.toHospital")}>
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
        <Field label={t("collab.labRouting.form.reason")}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
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
