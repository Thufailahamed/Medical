"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BedDouble, Plus } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatDate } from "@/hospital/lib/format";
import { cn } from "@/portal/lib/utils";

const STATUS_TONES: Record<string, any> = {
  admitted: "warn",
  discharged: "success",
  transferred: "info",
};

export default function IpdPage() {
  const t = useT();
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
        title={t("nav.ipd")}
        subtitle={t("ipd.subtitle")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            {t("ipd.admitPatient")}
          </Button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {["", "admitted", "discharged", "transferred"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              statusFilter === s
                ? "bg-brand text-white shadow-sm"
                : "bg-surface text-text-muted border border-border hover:bg-surface-2"
            )}
          >
            {s ? t(`ipd.status.${s}` as any) : t("common.all")}
          </button>
        ))}
      </div>

      <Card padding={false}>
        {list.isLoading ? (
          <p className="p-5 text-sm text-text-muted">{t("common.loading")}</p>
        ) : !list.data?.admissions?.length ? (
          <div className="p-5">
            <Empty
              title={t("ipd.noAdmissions")}
              icon={<BedDouble size={28} className="text-text-muted opacity-40" />}
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.name")}</TH>
                <TH>{t("ipd.reason")}</TH>
                <TH>{t("ipd.ward")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("common.date")}</TH>
                <TH> </TH>
              </TR>
            </THead>
            <TBody>
              {list.data.admissions.map((a: any) => (
                <TR key={a.id}>
                  <TD className="font-semibold">{a.patientName}</TD>
                  <TD className="text-text-muted">{a.reason ?? "—"}</TD>
                  <TD>{a.wardName ?? "—"}{a.bedNumber ? ` / ${a.bedNumber}` : ""}</TD>
                  <TD>
                    <Pill tone={STATUS_TONES[a.status] ?? "neutral"}>{a.status}</Pill>
                  </TD>
                  <TD className="text-text-muted">{formatDate(a.admittedAt, locale)}</TD>
                  <TD>
                    <Link
                      href={`/hospital/ipd/${a.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-strong"
                    >
                      {t("common.view")} <ArrowRight size={12} />
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={t("ipd.admitPatient")}>
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
          <FormField label={t("ipd.patientId")} required>
            <input
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            />
          </FormField>
          <FormField label={t("ipd.reason")}>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </FormField>
          <FormField label={t("ipd.diagnosis")}>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={form.diagnosisAtAdmission}
              onChange={(e) => setForm({ ...form, diagnosisAtAdmission: e.target.value })}
            />
          </FormField>
          <FormField label={t("ipd.ward")}>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
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
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t("ipd.admit")}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}