"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Beaker, Plus, Send } from "lucide-react";
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
  accepted: "info",
  completed: "success",
  cancelled: "neutral",
};

export default function LabRoutingPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("outgoing");
  const [newOpen, setNewOpen] = useState(false);

  const outgoing = useQuery({
    queryKey: ["cross-hospital-lab-routings", "outgoing"],
    queryFn: () => api<{ items: any[] }>("/cross-hospital-lab-routings/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["cross-hospital-lab-routings", "incoming"],
    queryFn: () => api<{ items: any[] }>("/cross-hospital-lab-routings/incoming"),
    refetchInterval: 30_000,
  });

  const items = (tab === "outgoing" ? outgoing : incoming).data?.items ?? [];

  const accept = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-lab-routings/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Accepted");
      qc.invalidateQueries({ queryKey: ["cross-hospital-lab-routings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const complete = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-lab-routings/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Completed");
      qc.invalidateQueries({ queryKey: ["cross-hospital-lab-routings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api(`/cross-hospital-lab-routings/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["cross-hospital-lab-routings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("collab.labRouting.title")}
        subtitle={t("collab.subtitle")}
        icon={<Beaker size={18} className="text-brand" />}
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Plus size={15} className="mr-1.5" />
            {t("collab.labRouting.new")}
          </Button>
        }
      />

      <div className="flex items-center gap-1 border-b border-border/60">
        <TabBtn
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
          label={t("collab.labRouting.outgoing")}
          count={outgoing.data?.items?.length ?? 0}
        />
        <TabBtn
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          label={t("collab.labRouting.incoming")}
          count={incoming.data?.items?.length ?? 0}
        />
      </div>

      <Card padding={false} className="overflow-hidden">
        {items.length === 0 ? (
          <Empty
            title={
              tab === "outgoing"
                ? t("collab.labRouting.noOutgoing")
                : t("collab.labRouting.noIncoming")
            }
            description={t("collab.subtitle")}
            className="py-12"
          />
        ) : (
          <Table className="border-0 rounded-none shadow-none">
            <THead>
              <TR>
                <TH>{tab === "outgoing" ? "To" : "From"}</TH>
                <TH>Tests</TH>
                <TH>Patient</TH>
                <TH>Reason</TH>
                <TH>{t("common.status")}</TH>
                <TH>Sent</TH>
                <TH className="text-right">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r: any) => (
                <TR key={r.routing.id}>
                  <TD className="font-medium">
                    {(tab === "outgoing" ? r.to : r.from)?.name ?? "—"}
                  </TD>
                  <TD className="text-xs">
                    {Array.isArray(r.order?.tests) ? r.order.tests.join(", ") : "—"}
                  </TD>
                  <TD className="text-xs text-text-muted">
                    {r.order?.patientId?.slice(0, 8) ?? "—"}
                  </TD>
                  <TD className="text-xs">{r.routing.reason}</TD>
                  <TD>
                    <Pill tone={STATUS_TONE[r.routing.status] ?? "neutral"} className="text-[11px]">
                      {t(`collab.labRouting.status.${r.routing.status}`)}
                    </Pill>
                  </TD>
                  <TD className="text-xs text-text-muted whitespace-nowrap">
                    {formatDate(r.routing.createdAt, locale)}
                  </TD>
                  <TD className="text-right">
                    {tab === "incoming" && r.routing.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => accept.mutate(r.routing.id)}
                        disabled={accept.isPending}
                      >
                        Accept
                      </Button>
                    ) : null}
                    {tab === "incoming" && r.routing.status === "accepted" ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => complete.mutate(r.routing.id)}
                        disabled={complete.isPending}
                      >
                        Mark complete
                      </Button>
                    ) : null}
                    {tab === "outgoing" &&
                    (r.routing.status === "pending" || r.routing.status === "accepted") ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancel.mutate(r.routing.id)}
                        disabled={cancel.isPending}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <NewRoutingModal open={newOpen} onClose={() => setNewOpen(false)} />
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
      api<{ orders: any[] }>(
        "/hospital-portal/lab-orders?status=ordered,sample_collected,in_progress"
      ),
    enabled: open,
  });
  const hospitalsQ = useQuery({
    queryKey: ["hospitals", "list"],
    queryFn: () => api<{ hospitals: any[] }>("/hospitals"),
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
      title={t("collab.labRouting.new")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            <Send size={14} className="mr-1.5" />
            {t("collab.labRouting.form.submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("collab.labRouting.form.labOrder")}>
          <select
            value={labOrderId}
            onChange={(e) => setLabOrderId(e.target.value)}
            className="portal-input w-full"
          >
            <option value="">Select lab order…</option>
            {ordersQ.data?.orders?.map((o: any) => (
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
        <Field label={t("collab.labRouting.form.reason")}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
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
