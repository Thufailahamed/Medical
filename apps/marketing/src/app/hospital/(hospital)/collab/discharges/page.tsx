"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Inbox,
  RefreshCw,
  Send,
  Undo2,
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
  HeroOverlap,
  PANEL,
  PanelHeader,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  PanelSkeleton,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type Tab = "outgoing" | "incoming";

interface Handoff {
  id: string;
  acknowledgedAt?: string | null;
  sharedAt?: string | null;
  createdAt: string;
  dischargeSummary?: string;
  followUpPlan?: string | null;
}
interface HandoffItem {
  handoff: Handoff;
  to?: { name?: string } | null;
  from?: { name?: string } | null;
  toHospital?: { name?: string } | null;
  toClinic?: { name?: string } | null;
  user?: { name?: string } | null;
}
interface HandoffDetail {
  handoff: Handoff;
  user?: { name?: string } | null;
  from?: { name?: string } | null;
}

export default function DischargesPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("incoming");
  const [activeId, setActiveId] = useState<string | null>(null);

  const outgoing = useQuery({
    queryKey: ["discharge-handoffs", "outgoing"],
    queryFn: () => api<{ items: HandoffItem[] }>("/discharge-handoffs/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["discharge-handoffs", "incoming"],
    queryFn: () => api<{ items: HandoffItem[] }>("/discharge-handoffs/incoming"),
    refetchInterval: 30_000,
  });

  const data = tab === "outgoing" ? outgoing : incoming;
  const items = data.data?.items ?? [];

  const outItems = outgoing.data?.items ?? [];
  const inItems = incoming.data?.items ?? [];
  const pendingAck = inItems.filter((r) => !r.handoff.acknowledgedAt).length;
  const ackedCount = [...outItems, ...inItems].filter((r) => !!r.handoff.acknowledgedAt).length;

  const ack = useMutation({
    mutationFn: (id: string) =>
      api(`/discharge-handoffs/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Acknowledged");
      qc.invalidateQueries({ queryKey: ["discharge-handoffs"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <DoctorHero
        kickerIcon={<Undo2 size={13} aria-hidden />}
        kicker={t("nav.collab")}
        kickerMeta={t("collab.tabs.discharges")}
        title={
          <>
            {t("collab.discharges.title")}{" "}
            <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
              · handoffs
            </span>
          </>
        }
        description={t("collab.subtitle")}
        chips={
          <>
            <span className={HERO_CHIP}>
              <Inbox size={12} className="text-amber-300" />
              {inItems.length} {t("collab.discharges.incoming").toLowerCase()}
            </span>
            <span className={HERO_CHIP}>
              <Send size={12} className="text-sky-300" />
              {outItems.length} {t("collab.discharges.outgoing").toLowerCase()}
            </span>
          </>
        }
        aside={
          <HeroPulse
            icon={<ClipboardCheck size={18} />}
            label="Awaiting acknowledgement"
            value={incoming.isLoading ? "…" : pendingAck}
            sub={pendingAck > 0 ? "Summaries to review" : "All acknowledged"}
          />
        }
        actions={
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
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Inbox size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("collab.discharges.incoming")}
          value={incoming.isLoading ? "…" : String(inItems.length)}
          sub="Received handoffs"
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          pulse={pendingAck > 0}
        />
        <StatTile
          icon={<Send size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("collab.discharges.outgoing")}
          value={outgoing.isLoading ? "…" : String(outItems.length)}
          sub="Sent to partners"
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
        />
        <StatTile
          icon={<ClipboardCheck size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Pending ack"
          value={String(pendingAck)}
          sub="Need your review"
          pulse={pendingAck > 0}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("collab.discharges.acknowledged")}
          value={String(ackedCount)}
          sub="Confirmed handoffs"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<FileText size={16} />}
            tone="bg-violet-50 text-violet-600"
            title={t("collab.discharges.title")}
            caption={data.isLoading ? t("common.loading") : `${items.length}`}
          />
          <div className="mt-4">
            <Segmented<Tab>
              ariaLabel="Handoff direction"
              value={tab}
              onChange={setTab}
              options={[
                { value: "incoming", label: t("collab.discharges.incoming"), count: inItems.length },
                { value: "outgoing", label: t("collab.discharges.outgoing"), count: outItems.length },
              ]}
            />
          </div>

          {data.isLoading ? (
            <PanelSkeleton rows={5} className="mt-4" />
          ) : items.length === 0 ? (
            <EmptyBlock
              icon={<Undo2 size={19} />}
              title={tab === "outgoing" ? t("collab.discharges.noOutgoing") : t("collab.discharges.noIncoming")}
              body={t("collab.subtitle")}
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((r) => {
                const counterpart =
                  tab === "outgoing"
                    ? r.toHospital?.name ?? r.toClinic?.name ?? "—"
                    : r.from?.name ?? "—";
                const acked = !!r.handoff.acknowledgedAt;
                return (
                  <li key={r.handoff.id}>
                    <RailRow
                      tone={acked ? "emerald" : "amber"}
                      active={!acked}
                      icon={<Building2 size={16} />}
                      title={
                        <>
                          {counterpart}{" "}
                          <span className="text-xs font-medium text-slate-400">· {r.user?.name ?? "—"}</span>
                        </>
                      }
                      meta={`${t("common.date")} ${formatDate(r.handoff.createdAt, locale)}${
                        r.handoff.sharedAt ? ` · shared ${formatDate(r.handoff.sharedAt, locale)}` : ""
                      }`}
                      trailing={
                        <>
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                              acked ? TONE_BADGE.emerald : TONE_BADGE.amber
                            )}
                          >
                            {acked ? t("collab.discharges.acknowledged") : "Pending"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveId(r.handoff.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                          >
                            {t("collab.discharges.viewSummary")}
                          </button>
                          {tab === "incoming" && !acked ? (
                            <button
                              type="button"
                              onClick={() => ack.mutate(r.handoff.id)}
                              disabled={ack.isPending}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} aria-hidden />
                              {t("collab.discharges.acknowledge")}
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
            id="discharge-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: FileText, label: t("collab.tabs.requests"), hint: "Chart access", href: "/hospital/collab/requests", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Inbox, label: t("collab.tabs.referrals"), hint: "Cross-hospital", href: "/hospital/collab/referrals", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
              { icon: Undo2, label: t("nav.ipd"), hint: "Active census", href: "/hospital/ipd", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
            ]}
          />
        </aside>
      </div>

      {activeId ? (
        <SummaryModal id={activeId} onClose={() => setActiveId(null)} />
      ) : null}
    </div>
  );
}

function SummaryModal({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["discharge-handoffs", id],
    queryFn: () => api<HandoffDetail>(`/discharge-handoffs/${id}`),
  });
  const ack = useMutation({
    mutationFn: () =>
      api(`/discharge-handoffs/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Acknowledged");
      qc.invalidateQueries({ queryKey: ["discharge-handoffs"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const data = detail.data;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={data?.user?.name ?? "Discharge summary"}
      subtitle={`From ${data?.from?.name ?? "?"}`}
      size="lg"
      footer={
        data && !data.handoff.acknowledgedAt ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[color:var(--ink-border)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              onClick={() => ack.mutate()}
              disabled={ack.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              {t("collab.discharges.acknowledge")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[color:var(--ink-border)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {t("common.close")}
          </button>
        )
      }
    >
      {detail.isLoading ? (
        <PanelSkeleton rows={4} />
      ) : data ? (
        <div className="space-y-4">
          <div>
            <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Discharge summary
            </h4>
            <div className="rounded-xl border border-[color:var(--ink-border)] bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-800">
              {data.handoff.dischargeSummary}
            </div>
          </div>
          {data.handoff.followUpPlan ? (
            <div>
              <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Follow-up plan
              </h4>
              <div className="rounded-xl border border-[color:var(--ink-border)] bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-800">
                {data.handoff.followUpPlan}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
