"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Pill, X } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";

type Tab = "queue" | "inventory";

export default function PharmacyPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.pharmacy")}
        subtitle={t("pharmacy.subtitle")}
      />

      <div className="flex gap-1 border-b border-border">
        {(["queue", "inventory"] as Tab[]).map((tt) => (
          <button
            key={tt}
            onClick={() => setTab(tt)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === tt
                ? "border-brand text-brand"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            {tt === "queue" ? t("nav.pharmacyQueue") : t("nav.pharmacyInventory")}
          </button>
        ))}
      </div>

      {tab === "queue" ? <Queue /> : <Inventory />}
    </div>
  );
}

function Queue() {
  const t = useT();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState<{ id: string } | null>(null);
  const [reason, setReason] = useState("");

  const queue = useQuery({
    queryKey: ["pharmacyQueue"],
    queryFn: () => api<{ prescriptions: any[] }>("/hospital-portal/pharmacy/queue"),
    refetchInterval: 30_000,
  });

  const dispense = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-portal/pharmacy/prescriptions/${id}/dispense`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pharmacyQueue"] });
      toast.success("Dispensed");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/hospital-portal/pharmacy/prescriptions/${id}/reject`, {
        method: "POST",
        json: { reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pharmacyQueue"] });
      setRejectOpen(null);
      setReason("");
      toast.success("Rejected");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const list = queue.data?.prescriptions ?? [];

  return (
    <Card padding={list.length === 0}>
      {queue.isLoading ? (
        <p className="text-sm text-text-muted">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <Empty
          title={t("pharmacy.emptyQueue")}
          icon={<Pill size={28} className="text-text-muted opacity-40" />}
        />
      ) : (
        <ul className="space-y-3">
          {list.map((p: any) => (
            <li
              key={p.id}
              className="rounded-xl border border-border bg-surface p-3 hover:border-brand/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-text">{p.patientName}</p>
                    <PillBadge tone="warn">{t("pharmacy.signed")}</PillBadge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("pharmacy.prescribedBy")}: {p.doctorName ?? "—"}
                  </p>
                  {p.diagnosis && (
                    <p className="mt-1 text-sm text-text">{p.diagnosis}</p>
                  )}
                  {p.items?.length ? (
                    <ul className="mt-2 list-disc pl-5 text-xs text-text-muted">
                      {p.items.map((it: any, i: number) => (
                        <li key={i}>
                          {it.medicineName} · {it.dosage} · qty {it.quantity}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Button size="sm" onClick={() => dispense.mutate(p.id)}>
                    <Check size={12} className="mr-1" />
                    {t("pharmacy.dispense")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRejectOpen({ id: p.id })}
                  >
                    <X size={12} className="mr-1" />
                    {t("pharmacy.reject")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!rejectOpen}
        onClose={() => setRejectOpen(null)}
        title={t("pharmacy.reject")}
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (rejectOpen) reject.mutate({ id: rejectOpen.id, reason });
          }}
        >
          <FormField label={t("pharmacy.reason")} required>
            <textarea
              required
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.submit")}</Button>
          </div>
        </Form>
      </Modal>
    </Card>
  );
}

function Inventory() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const inv = useQuery({
    queryKey: ["pharmacyInventory"],
    queryFn: () => api<{ rows: any[] }>("/hospital-portal/pharmacy/inventory"),
  });

  return (
    <Card padding={false}>
      {inv.isLoading ? (
        <p className="p-5 text-sm text-text-muted">{t("common.loading")}</p>
      ) : !inv.data?.rows?.length ? (
        <div className="p-5">
          <Empty title={t("pharmacy.emptyInventory")} />
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("pharmacy.medicine")}</TH>
              <TH>{t("pharmacy.dispensedQty")}</TH>
              <TH>{t("pharmacy.orderedQty")}</TH>
              <TH>{t("pharmacy.lastDispensed")}</TH>
            </TR>
          </THead>
          <TBody>
            {inv.data.rows.map((r: any, i: number) => (
              <TR key={i}>
                <TD className="font-semibold">{r.medicineName}</TD>
                <TD>{r.dispensedQty}</TD>
                <TD>{r.orderedQty}</TD>
                <TD className="text-text-muted">{r.lastDispensedAt ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}