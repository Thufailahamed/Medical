// Public viewer for a patient-shared record bundle.
//
// Reached by link: `${WEB_BASE_URL}/share/${token}`. No auth header —
// the backend's `GET /share/:token` (apps/api/src/routes/share.ts)
// validates by token + expiry + revoked flag, records the view in
// `share_link_views`, and returns a redacted bundle.
//
// The backend returns 404 for unknown / non-record-share tokens and
// 410 for expired / revoked links — we surface those verbatim.

import {
  FileText,
  Stethoscope,
  Pill as PillIcon,
  ShieldCheck,
  Download,
  ScanLine,
} from "lucide-react";

import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty } from "@/portal/components/ui/Empty";

interface ShareBundle {
  label: string;
  expiresAt: string;
  generatedAt: string;
  kind?: "record_share" | "prescription_share" | "record_bundle" | string;
  patient: {
    name?: string;
    dob: string | null;
    bloodGroup: string | null;
    sex: string | null;
  } | null;
  familyMember: { id: string; name: string; relationship: string | null } | null;
  allergies: Array<{
    id: string;
    allergen: string;
    severity: string;
    reaction: string | null;
  }>;
  medicines: Array<{
    id: string;
    name: string;
    dosage: string | null;
    frequency: string | null;
  }>;
  records: Array<{
    id: string;
    title: string;
    recordType?: string;
    kind: string | null;
    date: string | null;
    diagnosis: string | null;
    summary: string | null;
    tags?: string[] | null;
  }>;
  appointments: Array<{
    id: string;
    scheduledAt: string;
    doctorName: string | null;
    status: string;
  }>;
  prescription?: {
    id: string;
    diagnosis: string | null;
    notes: string | null;
    date: string;
    signedAt: string | null;
    status: string;
    signedPayloadHash: string | null;
  };
  doctor?: {
    doctorId: string;
    doctorUserId: string;
    doctorName: string;
    doctorSpecialization: string | null;
    doctorSlmcNo: string | null;
    doctorSlmcVerifiedAt: string | null;
  };
  pdfUrl?: string;
  verifyUrl?: string;
}

async function fetchBundle(token: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  const res = await fetch(`${base}/share/${encodeURIComponent(token)}`, {
    // No auth — public endpoint.
    cache: "no-store",
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

export default async function ShareViewerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { status, body } = await fetchBundle(token);

  if (status === 404) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Card>
          <h1 className="text-xl font-bold text-text">Link not found</h1>
          <p className="text-sm text-text-soft mt-2">
            This share link is invalid or has been removed. Ask the patient
            who shared it to send a new one.
          </p>
        </Card>
      </main>
    );
  }

  if (status === 410) {
    const msg =
      body?.error === "Link has been revoked"
        ? "This share link was revoked by the patient."
        : "This share link has expired.";
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Card>
          <h1 className="text-xl font-bold text-text">Link unavailable</h1>
          <p className="text-sm text-text-soft mt-2">{msg}</p>
        </Card>
      </main>
    );
  }

  if (status >= 400 || !body) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Card>
          <h1 className="text-xl font-bold text-text">Couldn't load link</h1>
          <p className="text-sm text-text-soft mt-2">
            Something went wrong while loading this share. Try again in a
            few minutes.
          </p>
        </Card>
      </main>
    );
  }

  const bundle = body as ShareBundle;
  const expiresOn = new Date(bundle.expiresAt).toLocaleString();
  const recordCount = bundle.records.length;
  const medCount = bundle.medicines?.length ?? 0;
  const allergyCount = bundle.allergies?.length ?? 0;
  // Tier 1 records: share-pack. The bundle has only the picked records
  // (no allergies/meds/appointments). Render a focused list with the
  // pack label prominently shown.
  const isPack = bundle.kind === "record_bundle";

  if (bundle.kind === "prescription_share") {
    const rx = bundle.prescription;
    const doc = bundle.doctor;
    const pat = bundle.patient;
    
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
    const pdfUrl = bundle.pdfUrl 
      ? (bundle.pdfUrl.startsWith("http") ? bundle.pdfUrl : `${apiBase}${bundle.pdfUrl}`) 
      : `/share/${token}/prescription.pdf`;
    
    return (
      <main className="mx-auto max-w-2xl p-6 md:p-8 space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Shared Doctor Prescription
          </p>
          <h1 className="text-2xl font-bold text-text">
            {pat?.name || "Patient"}
          </h1>
          <p className="text-xs text-text-muted">
            Link expires on {expiresOn}
          </p>
        </header>

        {/* Doctor and Clinic Card */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-soft rounded-2xl text-brand">
              <Stethoscope size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-soft">Prescribing Doctor</p>
              <h2 className="text-lg font-bold text-text mt-0.5">{doc?.doctorName || "Doctor"}</h2>
              <p className="text-sm text-text-soft">
                {doc?.doctorSpecialization || "Medical Practitioner"}
                {doc?.doctorSlmcNo ? ` · SLMC ${doc?.doctorSlmcNo}` : ""}
              </p>
            </div>
          </div>
        </Card>

        {/* Diagnosis & Notes */}
        {(rx?.diagnosis || rx?.notes) && (
          <Card>
            <h2 className="text-sm font-semibold text-text mb-2">Clinical Details</h2>
            {rx?.diagnosis && (
              <div className="mb-3">
                <span className="text-[11px] uppercase tracking-wider text-text-muted font-bold block">Diagnosis</span>
                <p className="text-sm text-text mt-0.5">{rx.diagnosis}</p>
              </div>
            )}
            {rx?.notes && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-text-muted font-bold block">Notes</span>
                <p className="text-sm text-text-soft mt-0.5">{rx.notes}</p>
              </div>
            )}
          </Card>
        )}

        {/* Medicines List */}
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-border/50">
            <h2 className="text-sm font-semibold text-text">
              Prescribed Medicines
              <span className="text-text-muted text-xs ml-2">
                ({bundle.medicines?.length ?? 0})
              </span>
            </h2>
          </div>
          {!bundle.medicines || bundle.medicines.length === 0 ? (
            <Empty
              icon={<PillIcon size={20} />}
              title="No medicines prescribed"
              description="This prescription has no active medicine entries."
            />
          ) : (
            <ul className="divide-y divide-border/50">
              {bundle.medicines.map((m) => (
                <li key={m.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary mt-0.5">
                    <PillIcon size={14} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-text">{m.name}</h3>
                    <p className="text-xs text-text-soft mt-0.5">
                      {[m.dosage, m.frequency, (m as any).timing].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {(m as any).instructions && (
                      <p className="text-[11px] text-text-muted mt-1">{(m as any).instructions}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Security / Signature Card */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-success-soft rounded-xl text-success">
              <ShieldCheck size={20} className="text-success" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-text">Cryptographically Signed</h3>
              <p className="text-xs text-text-soft mt-0.5">
                Verifiably signed by doctor on {rx?.signedAt ? new Date(rx.signedAt).toLocaleDateString() : rx?.date}
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <a
              href={pdfUrl}
              download={`prescription-${rx?.id.slice(0, 8)}.pdf`}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors"
            >
              <Download size={14} />
              Download Signed PDF
            </a>
            
            {bundle.verifyUrl && (
              <a
                href={bundle.verifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2 border border-border bg-surface text-text rounded-xl text-sm font-semibold hover:bg-surface-2 transition-colors"
              >
                <ScanLine size={14} />
                Verify Digital Signature
              </a>
            )}
          </div>
        </Card>

        <footer className="text-xs text-text-muted text-center pt-4">
          This prescription was signed electronically by {doc?.doctorName}. It is legally valid and binding under the Electronic Transactions Act.
        </footer>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6 md:p-8 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-text-muted">
          {isPack ? "Shared record pack" : "Shared health record"}
        </p>
        <h1 className="text-2xl font-bold text-text">
          {bundle.patient?.name || "Patient"}
        </h1>
        {isPack && bundle.label && (
          <p className="text-sm text-text-soft">Pack: {bundle.label}</p>
        )}
        {bundle.familyMember ? (
          <p className="text-sm text-text-soft">
            Records for family member: {bundle.familyMember.name}
            {bundle.familyMember.relationship
              ? ` (${bundle.familyMember.relationship})`
              : ""}
          </p>
        ) : null}
        <p className="text-xs text-text-muted">
          Link expires on {expiresOn} · viewed{" "}
          {new Date(bundle.generatedAt).toLocaleString()}
        </p>
      </header>

      {/* Tier 1 records: for record_bundle skip the legacy profile /
          allergies / medicines sections — those are not part of the
          pack payload. The records list below carries the entire
          bundle. */}
      {isPack ? null : (
        <>
          {bundle.patient ? (
        <Card>
          <h2 className="text-sm font-semibold text-text">Profile</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-text-soft">Blood group</dt>
            <dd>{bundle.patient.bloodGroup || "—"}</dd>
            <dt className="text-text-soft">Date of birth</dt>
            <dd>{bundle.patient.dob || "—"}</dd>
            <dt className="text-text-soft">Sex</dt>
            <dd>{bundle.patient.sex || "—"}</dd>
          </dl>
        </Card>
      ) : null}

      {allergyCount > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-text">Allergies</h2>
          <ul className="mt-2 space-y-1.5">
            {bundle.allergies.map((a) => (
              <li key={a.id} className="text-sm flex items-center gap-2">
                <Pill tone="danger">{a.severity}</Pill>
                <span className="font-medium">{a.allergen}</span>
                {a.reaction ? (
                  <span className="text-text-muted text-xs">
                    · {a.reaction}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {medCount > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-text">Medicines</h2>
          <ul className="mt-2 space-y-1.5">
            {bundle.medicines.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-medium">{m.name}</span>
                {m.dosage || m.frequency ? (
                  <span className="text-text-muted text-xs">
                    {" "}
                    · {[m.dosage, m.frequency].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
        </>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-border/50">
          <h2 className="text-sm font-semibold text-text">
            {isPack ? "Picked records" : "Recent records"}
            <span className="text-text-muted text-xs ml-2">
              ({recordCount})
            </span>
          </h2>
        </div>
        {recordCount === 0 ? (
          <Empty
            icon={<FileText size={20} />}
            title={
              isPack
                ? "No records in this pack"
                : "No records in the last 6 months"
            }
            description={
              isPack
                ? "The patient shared an empty pack."
                : "Ask the patient to share a longer window if you need older entries."
            }
          />
        ) : (
          <ul className="divide-y divide-border/50">
            {bundle.records.map((r) => (
              <li key={r.id} className="px-4 py-3 space-y-0.5">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-text-muted shrink-0" />
                  <span className="text-sm font-medium text-text truncate">
                    {r.title}
                  </span>
                  <Pill tone="neutral">{r.kind || r.recordType}</Pill>
                </div>
                {r.diagnosis ? (
                  <p className="text-xs text-text-soft pl-6">{r.diagnosis}</p>
                ) : null}
                {r.date ? (
                  <p className="text-[11px] text-text-muted pl-6">
                    {new Date(r.date).toLocaleDateString()}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <footer className="text-xs text-text-muted text-center pt-4">
        This link was shared for a specific purpose. Please handle the
        information with the same care as any other medical record.
      </footer>
    </main>
  );
}
