"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatDate } from "@/hospital/lib/format";

export default function AdmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useT();
  const { id } = use(params);
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);

  const admission = useQuery({
    queryKey: ["admission", id],
    queryFn: () => api<{ admission: any; patient: any; notes: any[] }>(`/hospital-portal/admissions/${id}`),
  });

  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({
    dischargeDiagnosis: "",
    dischargeInstructions: "",
    followUpDate: "",
  });
  const [noteForm, setNoteForm] = useState({ kind: "progress", body: "" });
  const [transferForm, setTransferForm] = useState({ wardId: "", bedId: "" });

  const discharge = useMutation({
    mutationFn: (body: any) =>
      api(`/hospital-portal/admissions/${id}/discharge`, { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admission", id] });
      setDischargeOpen(false);
      toast.success("Patient discharged");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const addNote = useMutation({
    mutationFn: (body: any) =>
      api(`/hospital-portal/admissions/${id}/notes`, { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admission", id] });
      setNoteOpen(false);
      setNoteForm({ kind: "progress", body: "" });
      toast.success("Note added");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const transfer = useMutation({
    mutationFn: (body: any) =>
      api(`/hospital-portal/admissions/${id}/transfer`, { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admission", id] });
      setTransferOpen(false);
      toast.success("Transferred");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const a = admission.data?.admission;
  const patient = admission.data?.patient;
  const notes = admission.data?.notes ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={patient?.name ?? t("ipd.admission")}
        subtitle={a?.reason ?? ""}
        actions={
          a?.status === "admitted" ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setNoteOpen(true)}>
                + {t("ipd.addNote")}
              </Button>
              <Button variant="ghost" onClick={() => setTransferOpen(true)}>
                {t("ipd.transfer")}
              </Button>
              <Button onClick={() => setDischargeOpen(true)}>
                {t("ipd.discharge")}
              </Button>
            </div>
          ) : (
            <Pill tone="success">{a?.status}</Pill>
          )
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="text-sm font-medium text-text-muted">
            {t("common.status")}
          </h3>
          <p className="mt-2 text-2xl font-semibold">{a?.status}</p>
          <p className="mt-1 text-xs text-text-muted">
            {t("common.from")}: {a?.admittedAt ? formatDate(a.admittedAt, locale) : "—"}
          </p>
          {a?.dischargedAt && (
            <p className="text-xs text-text-muted">
              {t("ipd.discharged")}: {formatDate(a.dischargedAt, locale)}
            </p>
          )}
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-text-muted">{t("ipd.ward")}</h3>
          <p className="mt-2 text-2xl font-semibold">{a?.wardName ?? "—"}</p>
          <p className="mt-1 text-xs text-text-muted">
            {t("ipd.bed")}: {a?.bedNumber ?? "—"}
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-text-muted">{t("ipd.diagnosis")}</h3>
          <p className="mt-2 text-sm">{a?.diagnosisAtAdmission ?? "—"}</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-lg font-semibold">{t("ipd.notes")}</h3>
        {notes.length === 0 ? (
          <p className="text-sm text-text-muted">{t("ipd.noNotes")}</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n: any) => (
              <li key={n.id} className="border-l-2 border-emerald-300 pl-3">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Pill tone="neutral">{n.kind}</Pill>
                  <span>{formatDate(n.recordedAt, locale)}</span>
                </div>
                <p className="mt-1 text-sm">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Discharge modal */}
      <Modal open={dischargeOpen} onClose={() => setDischargeOpen(false)} title={t("ipd.discharge")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            discharge.mutate(dischargeForm);
          }}
        >
          <FormField label={t("ipd.dischargeDiagnosis")}>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={dischargeForm.dischargeDiagnosis}
              onChange={(e) => setDischargeForm({ ...dischargeForm, dischargeDiagnosis: e.target.value })}
            />
          </FormField>
          <FormField label={t("ipd.instructions")}>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={dischargeForm.dischargeInstructions}
              onChange={(e) => setDischargeForm({ ...dischargeForm, dischargeInstructions: e.target.value })}
            />
          </FormField>
          <FormField label={t("ipd.followUpDate")}>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={dischargeForm.followUpDate}
              onChange={(e) => setDischargeForm({ ...dischargeForm, followUpDate: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDischargeOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("ipd.confirmDischarge")}</Button>
          </div>
        </Form>
      </Modal>

      {/* Note modal */}
      <Modal open={noteOpen} onClose={() => setNoteOpen(false)} title={t("ipd.addNote")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            addNote.mutate(noteForm);
          }}
        >
          <FormField label={t("ipd.noteKind")}>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={noteForm.kind}
              onChange={(e) => setNoteForm({ ...noteForm, kind: e.target.value })}
            >
              <option value="progress">Progress</option>
              <option value="vitals">Vitals</option>
              <option value="medication">Medication</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <FormField label={t("common.notes")} required>
            <textarea
              required
              rows={4}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={noteForm.body}
              onChange={(e) => setNoteForm({ ...noteForm, body: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setNoteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.save")}</Button>
          </div>
        </Form>
      </Modal>

      {/* Transfer modal */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title={t("ipd.transfer")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            transfer.mutate({
              wardId: transferForm.wardId || null,
              bedId: transferForm.bedId || null,
            });
          }}
        >
          <FormField label={t("ipd.ward")}>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={transferForm.wardId}
              onChange={(e) => setTransferForm({ ...transferForm, wardId: e.target.value })}
              placeholder="ward id (UUID)"
            />
          </FormField>
          <FormField label={t("ipd.bed")}>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={transferForm.bedId}
              onChange={(e) => setTransferForm({ ...transferForm, bedId: e.target.value })}
              placeholder="bed id (UUID)"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setTransferOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.save")}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}