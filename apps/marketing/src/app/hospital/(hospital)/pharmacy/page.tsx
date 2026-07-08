"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/portal/components/ui/Form";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";

type Tab = "queue" | "inventory";

export default function PharmacyPage() {
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.pharmacy")}
        subtitle={tr(locale, "pharmacy.subtitle")}
      />

      <div className="flex gap-2 border-b border-[var(--border)]">
        <button
          onClick={() => setTab("queue")}
          className={`border-b-2 px-4 py-2 text-sm ${
            tab === "queue"
              ? "border-[var(--accent-600)] font-semibold"
              : "border-transparent text-[var(--text-muted)]"
          }`}
        >
          {tr(locale, "nav.pharmacyQueue")}
        </button>
        <button
          onClick={() => setTab("inventory")}
          className={`border-b-2 px-4 py-2 text-sm ${
            tab === "inventory"
              ? "border-[var(--accent-600)] font-semibold"
              : "border-transparent text-[var(--text-muted)]"
          }`}
        >
          {tr(locale, "nav.pharmacyInventory")}
        </button>
      </div>

      {tab === "queue" ? <Queue /> : <Inventory />}
    </div>
  );
}

function Queue() {
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
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
    <Card>
      {queue.isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
      ) : list.length === 0 ? (
        <Empty title={tr(locale, "pharmacy.emptyQueue")} />
      ) : (
        <ul className="space-y-3">
          {list.map((p: any) => (
            <li
              key={p.id}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.patientName}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {tr(locale, "pharmacy.prescribedBy")}: {p.doctorName ?? "—"}
                  </p>
                  {p.diagnosis && (
                    <p className="mt-1 text-sm">{p.diagnosis}</p>
                  )}
                  {p.items?.length ? (
                    <ul className="mt-2 list-disc pl-5 text-xs text-[var(--text-muted)]">
                      {p.items.map((it: any, i: number) => (
                        <li key={i}>
                          {it.medicineName} · {it.dosage} · qty {it.quantity}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Pill tone="warning">{tr(locale, "pharmacy.signed")}</Pill>
                  <Button size="sm" onClick={() => dispense.mutate(p.id)}>
                    {tr(locale, "pharmacy.dispense")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRejectOpen({ id: p.id })}
                  >
                    {tr(locale, "pharmacy.reject")}
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
        title={tr(locale, "pharmacy.reject")}
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (rejectOpen) reject.mutate({ id: rejectOpen.id, reason });
          }}
        >
          <FormField label={tr(locale, "pharmacy.reason")} required>
            <textarea
              required
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(null)}>
              {tr(locale, "common.cancel")}
            </Button>
            <Button type="submit">{tr(locale, "common.submit")}</Button>
          </div>
        </Form>
      </Modal>
    </Card>
  );
}

function Inventory() {
  const locale = useAuthStore((s) => s.locale);
  const inv = useQuery({
    queryKey: ["pharmacyInventory"],
    queryFn: () => api<{ rows: any[] }>("/hospital-portal/pharmacy/inventory"),
  });

  return (
    <Card>
      {inv.isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
      ) : !inv.data?.rows?.length ? (
        <Empty title={tr(locale, "pharmacy.emptyInventory")} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{tr(locale, "pharmacy.medicine")}</TH>
              <TH>{tr(locale, "pharmacy.dispensedQty")}</TH>
              <TH>{tr(locale, "pharmacy.orderedQty")}</TH>
              <TH>{tr(locale, "pharmacy.lastDispensed")}</TH>
            </TR>
          </THead>
          <TBody>
            {inv.data.rows.map((r: any, i: number) => (
              <TR key={i}>
                <TD>{r.medicineName}</TD>
                <TD>{r.dispensedQty}</TD>
                <TD>{r.orderedQty}</TD>
                <TD>{r.lastDispensedAt ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}