"use client";

import Link from "next/link";
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
import { formatDate } from "@/hospital/lib/format";

const STATUS_TONES: Record<string, any> = {
  admitted: "warning",
  discharged: "success",
  transferred: "info",
};

export default function IpdPage() {
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [statusFilter, setStatusFilter] = useState("admitted");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    reason: "",
    diagnosisAtAdmission: "",
    wardId: "",
    bedId: "",
  });

  const list = useQuery({
    queryKey: ["admissions", statusFilter],
    queryFn: () =>
      api<{ admissions: any[] }>(
        `/hospital-portal/admissions${statusFilter ? `?status=${statusFilter}` : ""}`
      ),
    refetchInterval: 30_000,
  });

  const wards = useQuery({
    queryKey: ["wards"],
    queryFn: () => api<{ wards: any[] }>("/hospital-portal/wards"),
  });

  const create = useMutation({
    mutationFn: (body: any) =>
      api("/hospital-portal/admissions", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      setOpen(false);
      toast.success("Patient admitted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.ipd")}
        subtitle={tr(locale, "ipd.subtitle")}
        actions={
          <Button onClick={() => setOpen(true)}>+ {tr(locale, "ipd.admitPatient")}</Button>
        }
      />

      <div className="flex gap-2">
        {["", "admitted", "discharged", "transferred"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              statusFilter === s
                ? "bg-[var(--accent-600)] text-white"
                : "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)]"
            }`}
          >
            {s ? tr(locale, `ipd.status.${s}` as any) : tr(locale, "common.all")}
          </button>
        ))}
      </div>

      <Card>
        {list.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
        ) : !list.data?.admissions?.length ? (
          <Empty title={tr(locale, "ipd.noAdmissions")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{tr(locale, "common.name")}</TH>
                <TH>{tr(locale, "ipd.reason")}</TH>
                <TH>{tr(locale, "ipd.ward")}</TH>
                <TH>{tr(locale, "common.status")}</TH>
                <TH>{tr(locale, "common.date")}</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {list.data.admissions.map((a: any) => (
                <TR key={a.id}>
                  <TD>{a.patientName}</TD>
                  <TD>{a.reason ?? "—"}</TD>
                  <TD>{a.wardName ?? "—"}{a.bedNumber ? ` / ${a.bedNumber}` : ""}</TD>
                  <TD>
                    <Pill tone={STATUS_TONES[a.status] ?? "muted"}>{a.status}</Pill>
                  </TD>
                  <TD>{formatDate(a.admittedAt, locale)}</TD>
                  <TD>
                    <Link
                      href={`/hospital/ipd/${a.id}`}
                      className="text-sm text-[var(--accent-600)] hover:underline"
                    >
                      {tr(locale, "common.view")}
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={tr(locale, "ipd.admitPatient")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              ...form,
              wardId: form.wardId || null,
              bedId: form.bedId || null,
            });
          }}
        >
          <FormField label={tr(locale, "ipd.patientId")} required>
            <input
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            />
          </FormField>
          <FormField label={tr(locale, "ipd.reason")}>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </FormField>
          <FormField label={tr(locale, "ipd.diagnosis")}>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.diagnosisAtAdmission}
              onChange={(e) => setForm({ ...form, diagnosisAtAdmission: e.target.value })}
            />
          </FormField>
          <FormField label={tr(locale, "ipd.ward")}>
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.wardId}
              onChange={(e) => setForm({ ...form, wardId: e.target.value })}
            >
              <option value="">—</option>
              {wards.data?.wards?.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tr(locale, "common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {tr(locale, "ipd.admit")}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}