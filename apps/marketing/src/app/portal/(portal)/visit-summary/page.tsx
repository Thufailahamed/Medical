"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pill,
  FlaskConical,
  CalendarClock,
  Save,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea } from "@/portal/components/ui/Form";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";

interface PatientSummary {
  patient: { id: string; name: string } | null;
  allergies: Array<{ substance: string; severity: string }>;
}

interface RxDraft {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface LabDraft {
  testName: string;
  instructions: string;
}

interface VisitSummaryProps {
  searchParams: { patientId?: string; appointmentId?: string };
}

export default function VisitSummaryPage({
  searchParams,
}: VisitSummaryProps) {
  const router = useRouter();
  const t = useT();
  const qc = useQueryClient();
  const { patientId, appointmentId } = searchParams;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", patientId, "summary"],
    queryFn: () => api<PatientSummary>(`/doctor-portal/patients/${patientId}/summary`),
    enabled: !!patientId,
  });

  const [title, setTitle] = useState(`Visit ${new Date().toISOString().slice(0, 10)}`);
  const [diagnosis, setDiagnosis] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [notes, setNotes] = useState("");

  const [rx, setRx] = useState<RxDraft>({
    name: "",
    dosage: "",
    frequency: "",
    duration: "",
    instructions: "",
  });
  const [rxList, setRxList] = useState<RxDraft[]>([]);

  const [lab, setLab] = useState<LabDraft>({ testName: "", instructions: "" });
  const [labList, setLabList] = useState<LabDraft[]>([]);

  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [followUpTitle, setFollowUpTitle] = useState("Follow-up");
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [markCompleted, setMarkCompleted] = useState(!!appointmentId);

  const createVisit = useMutation({
    mutationFn: async () => {
      const body: any = {
        patientId,
        appointmentId,
        title,
        diagnosis: diagnosis || undefined,
        subjective: subjective || undefined,
        objective: objective || undefined,
        assessment: assessment || undefined,
        plan: plan || undefined,
        notes: notes || undefined,
        prescriptionItems: rxList.length > 0 ? rxList : undefined,
        labOrders: labList.length > 0 ? labList : undefined,
        followUp: followUpEnabled
          ? { followUpDate, title: followUpTitle, notes: followUpNotes || undefined }
          : undefined,
        markAppointmentCompleted: markCompleted,
      };
      await api("/doctor-portal/visit-summary", {
        method: "POST",
        json: body,
      });
    },
    onSuccess: () => {
      toast.success(t("visitSummary.saved"), "");
      qc.invalidateQueries({ queryKey: ["doctor-portal"] });
      router.push(`/portal/patients/${patientId}`);
    },
    onError: (err: any) => {
      toast.error(t("toast.error"), err?.message);
    },
  });

  const addRx = () => {
    if (!rx.name.trim()) return;
    setRxList((prev) => [...prev, { ...rx, name: rx.name.trim() }]);
    setRx({ name: "", dosage: "", frequency: "", duration: "", instructions: "" });
  };

  const removeRx = (index: number) => {
    setRxList((prev) => prev.filter((_, i) => i !== index));
  };

  const addLab = () => {
    if (!lab.testName.trim()) return;
    setLabList((prev) => [...prev, { ...lab, testName: lab.testName.trim() }]);
    setLab({ testName: "", instructions: "" });
  };

  const removeLab = (index: number) => {
    setLabList((prev) => prev.filter((_, i) => i !== index));
  };

  if (summaryLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          leftIcon={<ArrowLeft size={14} />}
        >
          {t("common.back")}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-text">{t("visitSummary.title")}</h1>
          <p className="text-sm text-text-soft mt-0.5">
            {summary?.patient?.name ?? patientId}
          </p>
        </div>
      </div>

      {/* Allergy Warning */}
      {summary?.allergies && summary.allergies.length > 0 && (
        <Card padding={false}>
          <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-danger-soft/30">
            <span className="text-xs font-medium text-danger">
              {t("chart.allergyWarning")}
            </span>
          </div>
          <div className="px-3 py-2 flex flex-wrap gap-1.5">
            {summary.allergies.map((a, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-[11px] bg-danger-soft text-danger border border-red-200">
                {a.substance} · {a.severity}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader title={t("visitSummary.basicInfo")} />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("visitSummary.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            label={t("visitSummary.diagnosis")}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute pharyngitis"
          />
        </div>
      </Card>

      {/* SOAP */}
      <Card>
        <CardHeader title="SOAP Notes" />
        <div className="mt-4 flex flex-col gap-4">
          <Textarea
            label={t("visitSummary.subjective")}
            value={subjective}
            onChange={(e) => setSubjective(e.target.value)}
            placeholder="What the patient reported..."
            rows={3}
          />
          <Textarea
            label={t("visitSummary.objective")}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Examination findings, vitals, labs..."
            rows={3}
          />
          <Textarea
            label={t("visitSummary.assessment")}
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            placeholder="Clinical impression..."
            rows={3}
          />
          <Textarea
            label={t("visitSummary.plan")}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="Treatment plan, instructions..."
            rows={3}
          />
        </div>
      </Card>

      {/* Prescription Items */}
      <Card>
        <CardHeader
          title={t("prescription.medicines")}
          right={
            <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={addRx}>
              {t("prescription.addMedicine")}
            </Button>
          }
        />
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <Input
                label={t("prescription.field.medicine")}
                value={rx.name}
                onChange={(e) => setRx((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Medicine name"
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label={t("prescription.field.dosage")}
                value={rx.dosage}
                onChange={(e) => setRx((prev) => ({ ...prev, dosage: e.target.value }))}
                placeholder="500 mg"
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label={t("prescription.field.frequency")}
                value={rx.frequency}
                onChange={(e) => setRx((prev) => ({ ...prev, frequency: e.target.value }))}
                placeholder="BD"
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label={t("prescription.field.duration")}
                value={rx.duration}
                onChange={(e) => setRx((prev) => ({ ...prev, duration: e.target.value }))}
                placeholder="5 days"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={addRx} className="w-full">
                {t("common.add")}
              </Button>
            </div>
          </div>
          {rxList.length > 0 && (
            <div className="flex flex-col gap-2">
              {rxList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-surface-2/40 border border-border">
                  <Pill size={14} className="text-brand shrink-0" />
                  <span className="text-sm text-text flex-1">
                    {item.name} {item.dosage} {item.frequency} {item.duration}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRx(idx)}
                    className="text-text-muted hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Lab Orders */}
      <Card>
        <CardHeader
          title={t("labs.title")}
          right={
            <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={addLab}>
              {t("labs.newOrder")}
            </Button>
          }
        />
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <Input
                label={t("labs.testName")}
                value={lab.testName}
                onChange={(e) => setLab((prev) => ({ ...prev, testName: e.target.value }))}
                placeholder="e.g. Complete Blood Count"
              />
            </div>
            <div className="md:col-span-5">
              <Input
                label={t("common.notes")}
                value={lab.instructions}
                onChange={(e) => setLab((prev) => ({ ...prev, instructions: e.target.value }))}
                placeholder="Instructions"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={addLab} className="w-full">
                {t("common.add")}
              </Button>
            </div>
          </div>
          {labList.length > 0 && (
            <div className="flex flex-col gap-2">
              {labList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-surface-2/40 border border-border">
                  <FlaskConical size={14} className="text-brand shrink-0" />
                  <span className="text-sm text-text flex-1">
                    {item.testName}
                    {item.instructions && ` — ${item.instructions}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLab(idx)}
                    className="text-text-muted hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Follow-up */}
      <Card>
        <CardHeader
          title={t("followups.title")}
          right={
            <button
              type="button"
              onClick={() => setFollowUpEnabled(!followUpEnabled)}
              className={`px-2.5 h-7 rounded-md text-xs border transition-colors ${
                followUpEnabled
                  ? "bg-brand-soft text-brand border-brand/30"
                  : "bg-surface text-text-soft border-border hover:bg-surface-2"
              }`}
            >
              {followUpEnabled ? t("common.enabled") : t("common.disabled")}
            </button>
          }
        />
        {followUpEnabled && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label={t("followups.dueDate")}
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
            <Input
              label={t("followups.reason")}
              value={followUpTitle}
              onChange={(e) => setFollowUpTitle(e.target.value)}
            />
            <Input
              label={t("common.notes")}
              value={followUpNotes}
              onChange={(e) => setFollowUpNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader title={t("common.notes")} />
        <div className="mt-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={3}
          />
        </div>
      </Card>

      {/* Mark Completed */}
      {appointmentId && (
        <Card padding={false}>
          <div className="px-4 py-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="markCompleted"
              checked={markCompleted}
              onChange={(e) => setMarkCompleted(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="markCompleted" className="text-sm text-text">
              {t("visitSummary.markAppointmentCompleted")}
            </label>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-bg py-2">
        <Button variant="ghost" onClick={() => router.back()}>
          {t("common.cancel")}
        </Button>
        <Button
          leftIcon={<Save size={14} />}
          onClick={() => createVisit.mutate()}
          loading={createVisit.isPending}
        >
          {t("visitSummary.saveAction")}
        </Button>
      </div>
    </div>
  );
}
