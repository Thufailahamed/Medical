"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Send } from "lucide-react";
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
import { formatDate, relativeTime } from "@/hospital/lib/format";
import { cn } from "@/portal/lib/utils";
import { toast } from "@/portal/components/ui/Toast";

type Tab = "outgoing" | "incoming";

const STATUS_TONE: Record<string, "info" | "success" | "warn" | "danger" | "neutral"> = {
  open: "warn",
  answered: "info",
  closed: "neutral",
};

export default function ConsultsPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("incoming");
  const [newOpen, setNewOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const outgoing = useQuery({
    queryKey: ["consult-notes", "outgoing"],
    queryFn: () => api<{ items: any[] }>("/consult-notes/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["consult-notes", "incoming"],
    queryFn: () => api<{ items: any[] }>("/consult-notes/incoming"),
    refetchInterval: 30_000,
  });

  const items = (tab === "outgoing" ? outgoing : incoming).data?.items ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("collab.consults.title")}
        subtitle={t("collab.subtitle")}
        icon={<MessageSquare size={18} className="text-brand" />}
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Plus size={15} className="mr-1.5" />
            {t("collab.consults.open")}
          </Button>
        }
      />

      <div className="flex items-center gap-1 border-b border-border/60">
        <TabBtn
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          label={t("collab.consults.incoming")}
          count={incoming.data?.items?.length ?? 0}
        />
        <TabBtn
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
          label={t("collab.consults.outgoing")}
          count={outgoing.data?.items?.length ?? 0}
        />
      </div>

      <Card padding={false} className="overflow-hidden">
        {items.length === 0 ? (
          <Empty
            title={
              tab === "outgoing"
                ? t("collab.consults.noOutgoing")
                : t("collab.consults.noIncoming")
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
                <TH>Question</TH>
                <TH>{t("common.status")}</TH>
                <TH>Last reply</TH>
                <TH className="text-right">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r: any) => (
                <TR key={r.note.id} className="cursor-pointer hover:bg-surface-2/40">
                  <TD className="font-medium" onClick={() => setActiveId(r.note.id)}>
                    {(tab === "outgoing" ? r.to : r.from)?.name ?? "—"}
                  </TD>
                  <TD onClick={() => setActiveId(r.note.id)}>{r.user?.name ?? "—"}</TD>
                  <TD className="text-xs text-text-soft max-w-[280px] truncate" onClick={() => setActiveId(r.note.id)}>
                    {r.note.question}
                  </TD>
                  <TD>
                    <Pill tone={STATUS_TONE[r.note.status] ?? "neutral"} className="text-[11px]">
                      {r.note.status}
                    </Pill>
                  </TD>
                  <TD className="text-xs text-text-muted whitespace-nowrap">
                    {r.note.lastReplyAt
                      ? relativeTime(r.note.lastReplyAt, locale)
                      : formatDate(r.note.createdAt, locale)}
                  </TD>
                  <TD className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setActiveId(r.note.id)}>
                      Open
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <NewConsultModal open={newOpen} onClose={() => setNewOpen(false)} />
      {activeId ? (
        <ConsultThreadModal id={activeId} onClose={() => setActiveId(null)} />
      ) : null}
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
    queryFn: () => api<{ patients: any[] }>("/hospital-portal/patients?status=registered"),
    enabled: open,
  });
  const hospitalsQ = useQuery({
    queryKey: ["hospitals", "list"],
    queryFn: () => api<{ hospitals: any[] }>("/hospitals"),
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
      title={t("collab.consults.open")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            <Send size={14} className="mr-1.5" />
            {t("collab.consults.form.submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("collab.consults.form.patient")}>
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
        <Field label={t("collab.consults.form.toHospital")}>
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
        <Field label={t("collab.consults.form.question")}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            className="portal-input w-full"
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
    queryFn: () => api<any>(`/consult-notes/${id}`),
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
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const closeMut = useMutation({
    mutationFn: () => api(`/consult-notes/${id}/close`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Consult closed");
      qc.invalidateQueries({ queryKey: ["consult-notes"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
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
            <Button variant="ghost" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
              {t("collab.consults.close")}
            </Button>
            <Button
              variant="primary"
              onClick={() => replyMut.mutate()}
              disabled={replyMut.isPending || !reply.trim()}
            >
              <Send size={14} className="mr-1.5" />
              Send reply
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            {t("common.close")}
          </Button>
        )
      }
    >
      {detail.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : data ? (
        <div className="flex flex-col gap-3">
          {(data.thread ?? []).map((m: any, idx: number) => (
            <div
              key={idx}
              className={cn(
                "rounded-lg p-3 text-sm",
                m.kind === "question"
                  ? "bg-brand-soft border border-brand/20"
                  : "bg-surface-2"
              )}
            >
              <div className="text-[11px] text-text-muted mb-1">
                {m.kind === "question" ? "Question" : "Reply"} ·{" "}
                {relativeTime(m.createdAt, locale)}
              </div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
          {!closed ? (
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t("collab.consults.replyPlaceholder")}
              rows={3}
              className="portal-input w-full mt-2"
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
      <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
