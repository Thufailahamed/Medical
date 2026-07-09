import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Hash,
  Pill,
  ShieldCheck,
  ShieldX,
  Stethoscope,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

type VerifyResponse = {
  valid: boolean;
  reason?: string;
  prescriptionId: string;
  signedAt?: string;
  payloadHash?: string;
  doctor?: {
    name: string;
    slmcRegistrationNo: string | null;
    specialization: string | null;
  } | null;
  medicines?: Array<{
    name: string;
    dosage?: string | null;
    frequency?: string | null;
    timing?: string | null;
  }>;
  date?: string;
};

async function verifyPrescription(id: string): Promise<VerifyResponse> {
  const res = await fetch(`${API_URL}/verify/${id}`, {
    next: { revalidate: 300 },
  });
  if (res.status === 404) {
    return { valid: false, reason: "not_found", prescriptionId: id };
  }
  if (!res.ok) {
    return { valid: false, reason: "error", prescriptionId: id };
  }
  return res.json();
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

const reasonLabels: Record<string, string> = {
  not_found: "Prescription not found.",
  no_signature: "This prescription has not been digitally signed.",
  revoked: "The signature has been revoked.",
  payload_mismatch: "The prescription content no longer matches the signature.",
  error: "Verification failed. Please try again.",
};

export default async function PublicVerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await verifyPrescription(id);
  const reason = data.reason ? reasonLabels[data.reason] ?? data.reason : null;

  return (
    <main className="min-h-screen bg-surface text-text">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <Link href="/" className="text-sm text-text-muted hover:text-text">
            HealthHub
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Prescription verification</h1>
            <p className="mt-1 text-sm text-text-muted">
              Public integrity check for prescription #{data.prescriptionId.slice(0, 8)}
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div
              className={
                data.valid
                  ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success"
                  : data.reason === "no_signature"
                    ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn"
                    : "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger"
              }
            >
              {data.valid ? (
                <ShieldCheck size={22} />
              ) : data.reason === "no_signature" ? (
                <AlertTriangle size={22} />
              ) : (
                <ShieldX size={22} />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">
                {data.valid
                  ? "Signature valid"
                  : data.reason === "no_signature"
                    ? "Not digitally signed"
                    : "Verification failed"}
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {data.valid
                  ? "The prescription content matches the stored digital signature."
                  : reason}
              </p>
              {data.signedAt ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-text-muted">
                  <Calendar size={13} />
                  Signed {formatDate(data.signedAt)}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {data.doctor ? (
          <section className="rounded-2xl border border-border bg-surface-2 p-5">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
              <Stethoscope size={15} />
              Prescriber
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Info label="Name" value={data.doctor.name} />
              <Info label="Specialization" value={data.doctor.specialization ?? "Not listed"} />
              <Info label="SLMC" value={data.doctor.slmcRegistrationNo ?? "Not listed"} mono />
            </div>
          </section>
        ) : null}

        {data.medicines?.length ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-surface-2">
            <div className="border-b border-border px-5 py-4">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                <Pill size={15} />
                Medicines
              </h2>
            </div>
            <ul>
              {data.medicines.map((medicine, index) => (
                <li
                  key={`${medicine.name}-${index}`}
                  className="border-b border-border px-5 py-4 last:border-b-0"
                >
                  <div className="font-medium">{medicine.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-muted">
                    {medicine.dosage ? <span>{medicine.dosage}</span> : null}
                    {medicine.frequency ? <span>{medicine.frequency}</span> : null}
                    {medicine.timing ? <span>{medicine.timing}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.payloadHash ? (
          <section className="rounded-2xl border border-border bg-surface-2 p-5">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
              <Hash size={15} />
              Payload hash
            </h2>
            <p className="mt-3 break-all font-mono text-xs text-text-muted">
              {data.payloadHash}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-text-muted">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}
