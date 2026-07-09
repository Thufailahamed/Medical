// Public viewer for a patient-shared record bundle.
//
// Reached by link: `${WEB_BASE_URL}/share/${token}`. No auth header —
// the backend's `GET /share/:token` (apps/api/src/routes/share.ts)
// validates by token + expiry + revoked flag, records the view in
// `share_link_views`, and returns a redacted bundle.
//
// The backend returns 404 for unknown / non-record-share tokens and
// 410 for expired / revoked links — we surface those verbatim.

import { FileText } from "lucide-react";

import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty } from "@/portal/components/ui/Empty";

interface ShareBundle {
  label: string;
  expiresAt: string;
  generatedAt: string;
  patient: {
    name: string;
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
    recordType: string;
    kind: string | null;
    date: string | null;
    diagnosis: string | null;
    summary: string | null;
  }>;
  appointments: Array<{
    id: string;
    scheduledAt: string;
    doctorName: string | null;
    status: string;
  }>;
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
  const medCount = bundle.medicines.length;
  const allergyCount = bundle.allergies.length;

  return (
    <main className="mx-auto max-w-2xl p-6 md:p-8 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-text-muted">
          Shared health record
        </p>
        <h1 className="text-2xl font-bold text-text">
          {bundle.patient?.name || "Patient"}
        </h1>
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

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-border/50">
          <h2 className="text-sm font-semibold text-text">
            Recent records
            <span className="text-text-muted text-xs ml-2">
              ({recordCount})
            </span>
          </h2>
        </div>
        {recordCount === 0 ? (
          <Empty
            icon={<FileText size={20} />}
            title="No records in the last 6 months"
            description="Ask the patient to share a longer window if you need older entries."
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
