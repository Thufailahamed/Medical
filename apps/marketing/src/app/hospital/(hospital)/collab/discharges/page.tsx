"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText } from "lucide-react";
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

export default function DischargesPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("incoming");
  const [activeId, setActiveId] = useState<string | null>(null);

  const outgoing = useQuery({
    queryKey: ["discharge-handoffs", "outgoing"],
    queryFn: () => api<{ items: any[] }>("/discharge-handoffs/outgoing"),
  });
  const incoming = useQuery({
    queryKey: ["discharge-handoffs", "incoming"],
    queryFn: () => api<{ items: any[] }>("/discharge-handoffs/incoming"),
    refetchInterval: 30_000,
  });

  const items = (tab === "outgoing" ? outgoing : incoming).data?.items ?? [];

  const ack = useMutation({
    mutationFn: (id: string) =>
      api(`/discharge-handoffs/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Acknowledged");
      qc.invalidateQueries({ queryKey: ["discharge-handoffs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("collab.discharges.title")}
        subtitle={t("collab.subtitle")}
        icon={<FileText size={18} className="text-brand" />}
      />

      <div className="flex items-center gap-1 border-b border-border/60">
        <TabBtn
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          label={t("collab.discharges.incoming")}
          count={incoming.data?.items?.length ?? 0}
        />
        <TabBtn
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
          label={t("collab.discharges.outgoing")}
          count={outgoing.data?.items?.length ?? 0}
        />
      </div>

      <Card padding={false} className="overflow-hidden">
        {items.length === 0 ? (
          <Empty
            title={
              tab === "outgoing"
                ? t("collab.discharges.noOutgoing")
                : t("collab.discharges.noIncoming")
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
                <TH>{t("common.status")}</TH>
                <TH>Shared</TH>
                <TH>Sent</TH>
                <TH className="text-right">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r: any) => (
                <TR key={r.handoff.id}>
                  <TD className="font-medium">
                    {tab === "outgoing"
                      ? r.toHospital?.name ?? r.toClinic?.name ?? "—"
                      : r.from?.name ?? "—"}
                  </TD>
                  <TD>{r.user?.name ?? "—"}</TD>
                  <TD>
                    {r.handoff.acknowledgedAt ? (
                      <Pill tone="success" className="text-[11px]">
                        {t("collab.discharges.acknowledged")}
                      </Pill>
                    ) : (
                      <Pill tone="warn" className="text-[11px]">
                        Pending
                      </Pill>
                    )}
                  </TD>
                  <TD className="text-xs text-text-muted whitespace-nowrap">
                    {r.handoff.sharedAt
                      ? formatDate(r.handoff.sharedAt, locale)
                      : "—"}
                  </TD>
                  <TD className="text-xs text-text-muted whitespace-nowrap">
                    {formatDate(r.handoff.createdAt, locale)}
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setActiveId(r.handoff.id)}>
                        {t("collab.discharges.viewSummary")}
                      </Button>
                      {tab === "incoming" && !r.handoff.acknowledgedAt ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => ack.mutate(r.handoff.id)}
                          disabled={ack.isPending}
                        >
                          <CheckCircle2 size={13} className="mr-1" />
                          {t("collab.discharges.acknowledge")}
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {activeId ? (
        <SummaryModal id={activeId} onClose={() => setActiveId(null)} />
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

function SummaryModal({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["discharge-handoffs", id],
    queryFn: () => api<any>(`/discharge-handoffs/${id}`),
  });
  const ack = useMutation({
    mutationFn: () =>
      api(`/discharge-handoffs/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Acknowledged");
      qc.invalidateQueries({ queryKey: ["discharge-handoffs"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
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
            <Button variant="ghost" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button variant="primary" onClick={() => ack.mutate()} disabled={ack.isPending}>
              <CheckCircle2 size={14} className="mr-1.5" />
              {t("collab.discharges.acknowledge")}
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
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-1.5">
              Discharge summary
            </h4>
            <div className="rounded-lg border border-border/60 bg-surface-2 p-3 text-sm whitespace-pre-wrap">
              {data.handoff.dischargeSummary}
            </div>
          </div>
          {data.handoff.followUpPlan ? (
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase mb-1.5">
                Follow-up plan
              </h4>
              <div className="rounded-lg border border-border/60 bg-surface-2 p-3 text-sm whitespace-pre-wrap">
                {data.handoff.followUpPlan}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
