import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Hash,
  Pill,
  ShieldCheck,
  ShieldX,
  Stethoscope,
  XCircle,
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
  // Migration 0059: redemption state surfaced by /verify when the
  // row has been dispensed (or was signed without a token). status
  // is always returned once the row exists; dispenseTokenConsumed /
  // tokenMatches only surface when the caller sent ?t=<token>.
  status?: "signed" | "dispensed" | "cancelled" | "draft";
  dispenseTokenConsumed?: boolean;
  tokenMatches?: boolean | null;
  dispensedAt?: string | null;
  dispensedBy?: {
    pharmacyName: string | null;
    userName: string | null;
  } | null;
  cancelledAt?: string | null;
};

async function verifyPrescription(
  id: string,
  token: string | null
): Promise<VerifyResponse> {
  const url = token
    ? `${API_URL}/verify/${id}?t=${encodeURIComponent(token)}`
    : `${API_URL}/verify/${id}`;
  const res = await fetch(url, {
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

function formatDate(value?: string | null) {
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t: tokenParam } = await searchParams;
  // Migration 0059: when the QR URL carries ?t=<token>, forward it to
  // /verify so the response tells us if THIS particular token has
  // been redeemed. Falls back to id-only verify (public by id) when
  // no token was provided.
  const data = await verifyPrescription(id, tokenParam ?? null);
  const reason = data.reason ? reasonLabels[data.reason] ?? data.reason : null;

  // Redemption-state UI banner. Only render when the row has a
  // signed signature AND a known state (skip the "not found" /
  // "no signature" rows so we don't pile a third card on top of the
  // existing failure banner).
  const showRedemption =
    data.valid && (data.status === "signed" || data.status === "dispensed" || data.status === "cancelled");
  const isDispensed = data.status === "dispensed";
  const isCancelled = data.status === "cancelled";

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

        {showRedemption ? (
          <section
            className={
              isCancelled
                ? "rounded-2xl border border-border bg-warn-soft/30 p-5"
                : isDispensed
                  ? "rounded-2xl border border-border bg-surface-2 p-5"
                  : "rounded-2xl border border-border bg-surface-2 p-5"
            }
          >
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
              {isCancelled ? (
                <>
                  <XCircle size={15} />
                  Cancelled
                </>
              ) : isDispensed ? (
                <>
                  <CheckCircle2 size={15} />
                  Already dispensed
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  Not yet dispensed
                </>
              )}
            </h2>

            {isCancelled ? (
              <p className="mt-3 text-sm text-text">
                This prescription was cancelled
                {data.cancelledAt ? ` on ${formatDate(data.cancelledAt)}` : ""}
                {" "}and cannot be dispensed.
              </p>
            ) : isDispensed ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Info
                  label="Dispensed at"
                  value={formatDate(data.dispensedAt)}
                />
                <Info
                  label="Dispensed by"
                  value={
                    data.dispensedBy
                      ? [
                          data.dispensedBy.pharmacyName,
                          data.dispensedBy.userName,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "Not recorded"
                  }
                />
                {tokenParam ? (
                  <Info
                    label="Token"
                    value={
                      data.dispenseTokenConsumed
                        ? "Already redeemed (this QR has been used)"
                        : data.tokenMatches === false
                          ? "Token does not match this prescription"
                          : "Token valid"
                    }
                    mono
                  />
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-text">
                This prescription is signed and ready to be presented at a
                pharmacy. Each QR code can only be redeemed once.
              </p>
            )}
          </section>
        ) : null}

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
