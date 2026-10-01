"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Inbox,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Share2,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Modal } from "@/portal/components/ui/Modal";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatDate, relativeTime } from "@/hospital/lib/format";
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
  open: TONE_BADGE.amber,
  answered: TONE_BADGE.sky,
  closed: TONE_BADGE.slate,
};

const STATUS_RAIL: Record<string, "amber" | "sky" | "slate"> = {
  open: "amber",
  answered: "sky",
  closed: "slate",
};

interface ConsultNote {
  id: string;
  status: string;
  question: string;
  lastReplyAt?: string | null;
  createdAt: string;
}
interface ConsultItem {
  note: ConsultNote;
  to?: { id: string; name: string } | null;
  from?: { id: string; name: string } | null;
  user?: { name?: string } | null;
}
interface ThreadMessage {
  kind: string;
  body: string;
  createdAt: string;
}
interface ConsultDetail {
  note: { status: string };
  user?: { name?: string } | null;
  from?: { name?: string } | null;
  to?: { name?: string } | null;
  thread?: ThreadMessage[];
}

export default function ConsultsPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("incoming");
  const [newOpen, setNewOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const outgoing = useQuery({
    queryKey: ["consult-notes", "outgoing"],
    queryFn: () => api<{ items: ConsultItem[] }>("/consult-notes/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["consult-notes", "incoming"],
    queryFn: () => api<{ items: ConsultItem[] }>("/consult-notes/incoming"),
    refetchInterval: 30_000,
  });

  const data = tab === "outgoing" ? outgoing : incoming;
  const items = data.data?.items ?? [];

  const outItems = outgoing.data?.items ?? [];
  const inItems = incoming.data?.items ?? [];
  const openCount = [...outItems, ...inItems].filter((r) => r.note.status === "open").length;
  const answeredCount = [...outItems, ...inItems].filter((r) => r.note.status === "answered").length;
  const openIn = inItems.filter((r) => r.note.status === "open").length;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <DoctorHero
        kickerIcon={<MessageSquare size={13} aria-hidden />}
        kicker={t("nav.collab")}
        kickerMeta={t("collab.tabs.consults")}
        title={
          <>
            {t("collab.consults.title")}{" "}
            <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
              · expert advice
            </span>
          </>
        }
        description={t("collab.subtitle")}
        chips={
          <>
            <span className={HERO_CHIP}>
              <Inbox size={12} className="text-amber-300" />
              {inItems.length} {t("collab.consults.incoming").toLowerCase()}
            </span>
            <span className={HERO_CHIP}>
              <Send size={12} className="text-sky-300" />
              {outItems.length} {t("collab.consults.outgoing").toLowerCase()}
            </span>
          </>
        }
        aside={
          <HeroPulse
            icon={<MessageSquare size={18} />}
            label="Open consults"
            value={incoming.isLoading || outgoing.isLoading ? "…" : openCount}
            sub={openIn > 0 ? `${openIn} awaiting your reply` : "Nothing awaiting"}
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
              {t("collab.consults.open")}
            </button>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Inbox size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("collab.consults.incoming")}
          value={incoming.isLoading ? "…" : String(inItems.length)}
          sub={`${openIn} open`}
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          pulse={openIn > 0}
        />
        <StatTile
          icon={<Send size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("collab.consults.outgoing")}
          value={outgoing.isLoading ? "…" : String(outItems.length)}
          sub="Asked by us"
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
        />
        <StatTile
          icon={<MessageSquare size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Answered"
          value={String(answeredCount)}
          sub="With replies"
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Open threads"
          value={String(openCount)}
          sub="Awaiting resolution"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<MessageSquare size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            title={t("collab.consults.title")}
            caption={data.isLoading ? t("common.loading") : `${items.length}`}
          />
          <div className="mt-4">
            <Segmented<Tab>
              ariaLabel="Consult direction"
              value={tab}
              onChange={setTab}
              options={[
                { value: "incoming", label: t("collab.consults.incoming"), count: inItems.length },
                { value: "outgoing", label: t("collab.consults.outgoing"), count: outItems.length },
              ]}
            />
          </div>

          {data.isLoading ? (
            <PanelSkeleton rows={5} className="mt-4" />
          ) : items.length === 0 ? (
            <EmptyBlock
              icon={<MessageSquare size={19} />}
              title={tab === "outgoing" ? t("collab.consults.noOutgoing") : t("collab.consults.noIncoming")}
              body={t("collab.subtitle")}
              actions={
                <button type="button" onClick={() => setNewOpen(true)} className={PRIMARY_BTN}>
                  <Plus size={13} /> {t("collab.consults.open")}
                </button>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((r) => {
                const hospital = (tab === "outgoing" ? r.to : r.from)?.name ?? "—";
                return (
                  <li key={r.note.id}>
                    <RailRow
                      tone={STATUS_RAIL[r.note.status] ?? "slate"}
                      active={r.note.status === "open"}
                      icon={<MessageSquare size={16} />}
                      title={
                        <>
                          {hospital}{" "}
                          <span className="text-xs font-medium text-slate-400">· {r.user?.name ?? "—"}</span>
                        </>
                      }
                      meta={
                        <>
                          <span className="line-clamp-1">{r.note.question}</span>
                          <span className="ml-2 shrink-0 text-slate-400">
                            {r.note.lastReplyAt
                              ? relativeTime(r.note.lastReplyAt, locale)
                              : formatDate(r.note.createdAt, locale)}
                          </span>
                        </>
                      }
                      trailing={
                        <>
                          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_BADGE[r.note.status] ?? TONE_BADGE.slate)}>
                            {r.note.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveId(r.note.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                          >
                            {t("collab.consults.open")}
                            <ArrowRight size={13} aria-hidden />
                          </button>
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
            id="consult-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: FileText, label: t("collab.tabs.requests"), hint: "Chart access", href: "/hospital/collab/requests", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Share2, label: t("collab.tabs.referrals"), hint: "Cross-hospital", href: "/hospital/collab/referrals", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
              { icon: ArrowRight, label: t("collab.tabs.discharges"), hint: "Handoffs", href: "/hospital/collab/discharges", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
            ]}
          />
        </aside>
      </div>

      <NewConsultModal open={newOpen} onClose={() => setNewOpen(false)} />
      {activeId ? (
        <ConsultThreadModal id={activeId} onClose={() => setActiveId(null)} />
      ) : null}
    </div>
  );
}

function NewConsultModal({
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
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const patientsQ = useQuery({
    queryKey: ["hospital-portal", "patients", { forConsult: true }],
    queryFn: () => api<{ patients: { id: string; name: string; mrn?: string }[] }>("/hospital-portal/patients?status=registered"),
    enabled: open,
  });
  const hospitalsQ = useQuery({
    queryKey: ["hospitals", "list"],
    queryFn: () => api<{ hospitals: { id: string; name: string }[] }>("/hospitals"),
    enabled: open,
  });

  const submit = async () => {
    if (!patientId || !toHospitalId || !question.trim()) {
      toast.error("All fields required");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/consult-notes`, {
        method: "POST",
        json: { patientId, toHospitalId, question: question.trim() },
      });
      toast.success("Consult sent");
      qc.invalidateQueries({ queryKey: ["consult-notes"] });
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
      title={t("collab.consults.open")}
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
            {t("collab.consults.form.submit")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("collab.consults.form.patient")}>
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
        <Field label={t("collab.consults.form.toHospital")}>
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
        <Field label={t("collab.consults.form.question")}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            className={FIELD_TEXTAREA}
          />
        </Field>
      </div>
    </Modal>
  );
}

function ConsultThreadModal({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [reply, setReply] = useState("");

  const detail = useQuery({
    queryKey: ["consult-notes", id],
    queryFn: () => api<ConsultDetail>(`/consult-notes/${id}`),
  });

  const replyMut = useMutation({
    mutationFn: () =>
      api(`/consult-notes/${id}/reply`, {
        method: "POST",
        json: { body: reply },
      }),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["consult-notes"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const closeMut = useMutation({
    mutationFn: () => api(`/consult-notes/${id}/close`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Consult closed");
      qc.invalidateQueries({ queryKey: ["consult-notes"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const data = detail.data;
  const closed = data?.note?.status === "closed";

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={data?.user?.name ?? "Consult"}
      subtitle={`${data?.from?.name ?? "?"} → ${data?.to?.name ?? "?"}`}
      size="lg"
      footer={
        !closed && data ? (
          <>
            <button
              type="button"
              onClick={() => closeMut.mutate()}
              disabled={closeMut.isPending}
              className="rounded-xl border border-[color:var(--ink-border)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {t("collab.consults.close")}
            </button>
            <button
              type="button"
              onClick={() => replyMut.mutate()}
              disabled={replyMut.isPending || !reply.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <Send size={14} />
              Send reply
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
        <div className="flex flex-col gap-3">
          {(data.thread ?? []).map((m, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-xl p-3.5 text-sm",
                m.kind === "question"
                  ? "border border-sky-200 bg-sky-50"
                  : "bg-slate-50"
              )}
            >
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {m.kind === "question" ? "Question" : "Reply"} ·{" "}
                {relativeTime(m.createdAt, locale)}
              </div>
              <div className="whitespace-pre-wrap text-slate-800">{m.body}</div>
            </div>
          ))}
          {!closed ? (
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t("collab.consults.replyPlaceholder")}
              rows={3}
              className={cn(FIELD_TEXTAREA, "mt-2")}
            />
          ) : null}
        </div>
      ) : null}
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
