"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Loader2,
  FileText,
  Check,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Field, Input, Textarea } from "@/portal/components/ui/Form";

interface Enrollment {
  id: string;
  policyNumber: string | null;
  status: string;
  planName?: string;
  providerName?: string;
}

const TREATMENTS = [
  { value: "hospitalization", label: "Hospitalization" },
  { value: "day_care", label: "Day care" },
  { value: "opd", label: "OPD" },
  { value: "dental", label: "Dental" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "maternity", label: "Maternity" },
] as const;

const DOC_KINDS = [
  { value: "bill", label: "Hospital bill" },
  { value: "discharge_summary", label: "Discharge summary" },
  { value: "prescription", label: "Prescription" },
  { value: "lab_report", label: "Lab report" },
  { value: "id_proof", label: "ID proof" },
] as const;

interface UploadedDoc {
  kind: string;
  fileKey: string;
  fileName?: string;
}

export default function NewClaimPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [enrollmentId, setEnrollmentId] = useState<string>("");
  const [treatmentType, setTreatmentType] = useState<string>("hospitalization");
  const [facility, setFacility] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [pendingDocKind, setPendingDocKind] = useState<string>("bill");

  const enrollQ = useQuery({
    queryKey: ["insurance", "enrollments", "me"],
    queryFn: () =>
      api<{ enrollments: Enrollment[] }>(
        "/insurance-marketplace/enrollments/me",
      ),
  });

  const activeEnrollments =
    enrollQ.data?.enrollments?.filter((e) => e.status === "active") ?? [];

  // Auto-pick first active enrollment once data loads
  if (
    !enrollmentId &&
    activeEnrollments.length > 0 &&
    activeEnrollments[0]
  ) {
    setEnrollmentId(activeEnrollments[0].id);
  }

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api<{ file: { r2Key: string } }>("/files/upload", {
        method: "POST",
        body: formData,
      });
      return res.file.r2Key;
    },
  });

  const createMut = useMutation({
    mutationFn: () =>
      api<{ claim: { id: string } }>(
        "/insurance-marketplace/claims",
        {
          method: "POST",
          json: {
            enrollmentId,
            treatmentType,
            incurringFacility: facility || undefined,
            admissionDate: admissionDate || undefined,
            dischargeDate: dischargeDate || undefined,
            diagnosis: diagnosis || undefined,
            amountRequestedLkr: Number(amount) || 0,
            patientRemarks: remarks || undefined,
            documents: docs.map((d) => ({
              kind: d.kind,
              fileKey: d.fileKey,
              fileName: d.fileName,
            })),
          },
        },
      ),
  });

  const submitMut = useMutation({
    mutationFn: (claimId: string) =>
      api(`/insurance-marketplace/claims/${claimId}/submit`, {
        method: "POST",
      }),
  });

  const onPickFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r2Key = await uploadMut.mutateAsync(file);
      setDocs((prev) => [
        ...prev,
        { kind: pendingDocKind, fileKey: r2Key, fileName: file.name },
      ]);
    } catch {
      alert("Upload failed");
    }
    e.target.value = "";
  };

  const onSubmit = async () => {
    if (!enrollmentId || !amount || docs.length === 0) return;
    const created = await createMut.mutateAsync();
    await submitMut.mutateAsync(created.claim.id);
    qc.invalidateQueries({ queryKey: ["insurance"] });
    router.push(`/portal/me/insurance/claims/${created.claim.id}`);
  };

  if (enrollQ.isLoading) return <Skeleton className="h-48 w-full" />;

  const submitting = createMut.isPending || submitMut.isPending;
  const canSubmit =
    !!enrollmentId &&
    !!amount &&
    docs.length > 0 &&
    !submitting;

  return (
    <div className="space-y-5 max-w-3xl">
      <button
        onClick={() => router.back()}
        className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back
      </button>

      <header>
        <h1 className="text-2xl font-bold text-text">Submit a claim</h1>
        <p className="text-sm text-text-soft mt-0.5">
          Reimbursement claim. Upload your final hospital bill and discharge summary.
        </p>
      </header>

      {activeEnrollments.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <p className="text-sm text-amber-800">
            You need an active policy to submit a claim.{" "}
            <a
              href="/portal/me/insurance/marketplace"
              className="font-semibold underline"
            >
              Browse plans →
            </a>
          </p>
        </Card>
      ) : (
        <>
          <Card className="space-y-4">
            <h2 className="font-bold text-text">Choose policy</h2>
            <div className="flex flex-wrap gap-2">
              {activeEnrollments.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEnrollmentId(e.id)}
                  className={`text-sm px-3 py-2 rounded-md border ${
                    enrollmentId === e.id
                      ? "bg-brand-soft border-brand text-brand-strong font-semibold"
                      : "border-border text-text-soft"
                  }`}
                >
                  {e.policyNumber ?? e.id.slice(0, 8)}
                  {e.planName ? (
                    <span className="ml-1.5 text-[11px] text-text-muted">
                      {e.planName}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-bold text-text">Treatment details</h2>

            <Field label="Treatment type">
              <div className="flex flex-wrap gap-2">
                {TREATMENTS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTreatmentType(t.value)}
                    className={`text-xs px-3 py-1.5 rounded-md border ${
                      treatmentType === t.value
                        ? "bg-brand-soft border-brand text-brand-strong font-semibold"
                        : "border-border text-text-soft"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Hospital / facility">
              <Input
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                placeholder="Asiri Surgical Hospital"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Admission date">
                <Input
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                />
              </Field>
              <Field label="Discharge date">
                <Input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Diagnosis">
              <Textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={2}
                placeholder="Brief description of condition / procedure"
              />
            </Field>

            <Field label="Amount requested (LKR)">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="150000"
              />
            </Field>

            <Field label="Notes for the reviewer">
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Any extra context (e.g. accident details)"
              />
            </Field>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-bold text-text">Documents</h2>
            <p className="text-xs text-text-soft">
              At least one document is required (PDF, image, or DICOM).
            </p>
            <Field label="Document type">
              <div className="flex flex-wrap gap-2">
                {DOC_KINDS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setPendingDocKind(d.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      pendingDocKind === d.value
                        ? "bg-brand text-white border-brand font-semibold"
                        : "border-border text-text-soft"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*,application/dicom"
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={onPickFile}
              loading={uploadMut.isPending}
            >
              <Upload size={14} />
              Upload document
            </Button>

            {docs.length > 0 ? (
              <ul className="space-y-1.5">
                {docs.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-md text-sm"
                  >
                    <Check size={14} className="text-emerald-600" />
                    <FileText size={14} className="text-text-muted" />
                    <span className="flex-1 truncate text-text">
                      {d.fileName ?? d.fileKey.slice(0, 24)}
                    </span>
                    <Pill tone="neutral">{d.kind.replace(/_/g, " ")}</Pill>
                    <button
                      onClick={() =>
                        setDocs(docs.filter((_, j) => j !== i))
                      }
                      className="text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {(createMut.isError || submitMut.isError) && (
            <Card className="border-red-200 bg-red-50/40">
              <p className="text-sm text-red-700">
                Submission failed. Please retry.
              </p>
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              onClick={onSubmit}
              disabled={!canSubmit}
              loading={submitting}
              size="lg"
            >
              Submit claim
            </Button>
          </div>
        </>
      )}
    </div>
  );
}