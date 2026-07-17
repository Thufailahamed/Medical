// apps/marketing/src/app/invite/[token]/page.tsx
//
// Public landing page for family + caretaker invites. Tries both
// preview endpoints and renders whichever one matches the token, then
// shows two CTAs:
//   1. "Open in app" — healthcare://invite/<token> deep link, the
//      primary path when HealthHub is installed.
//   2. Install links for App Store / Play Store as a fallback.
//
// Reached by sharing the link in chat, email, or SMS. No auth header —
// the API's public preview endpoints validate by token + expiry + lock.
//
// The API's own HTML landing at apps/api/src/routes/invite-page.ts
// is family-only; this marketing route is the unified, branded version
// that handles both invite types and surfaces a richer CTA surface.

import { Users, ShieldCheck, Calendar, Smartphone } from "lucide-react";

import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty } from "@/portal/components/ui/Empty";

type InviteKind = "family" | "caretaker";

interface FamilyPreview {
  inviterName?: string;
  inviterPhoto?: string | null;
  inviteeName?: string;
  relationship?: string | null;
  expiresAt?: string;
  consumed?: boolean;
}

interface CaretakerPreview {
  inviterName?: string;
  inviterPhoto?: string | null;
  caretakerName?: string;
  careRole?: string;
  channelHint?: string;
  expiresAt?: string;
  consumed?: boolean;
  locked?: boolean;
}

const APP_STORE_URL = "https://apps.apple.com/app/id000000000";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=app.healthhub.mobile";

async function fetchJson<T>(url: string): Promise<{
  status: number;
  body: T | null;
}> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return { status: 0, body: null };
  }
}

async function resolveInvite(
  token: string
): Promise<{ kind: InviteKind; data: any } | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  // Caretaker invites have OTP-protected preview; even if auth is
  // required, a 401/404 still tells us the token isn't family.
  const fam = await fetchJson<FamilyPreview>(
    `${base}/family/invites/${encodeURIComponent(token)}`
  );
  if (fam.status === 200 && fam.body) {
    return { kind: "family", data: fam.body };
  }
  const care = await fetchJson<CaretakerPreview>(
    `${base}/caretaker/invites/${encodeURIComponent(token)}`
  );
  if (care.status === 200 && care.body) {
    return { kind: "caretaker", data: care.body };
  }
  return null;
}

export default async function InviteLanding({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await resolveInvite(token);
  const deepLink = `healthcare://invite/${token}`;

  if (!invite) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Card>
          <h1 className="text-xl font-bold text-text">Invite unavailable</h1>
          <p className="text-sm text-text-soft mt-2">
            This invite link is invalid, has expired, or has been revoked.
            Ask the person who sent it to create a new one.
          </p>
        </Card>
      </main>
    );
  }

  if (invite.kind === "caretaker" && (invite.data as CaretakerPreview).locked) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Card>
          <h1 className="text-xl font-bold text-text">Invite locked</h1>
          <p className="text-sm text-text-soft mt-2">
            Too many incorrect code attempts. Ask the sender to revoke this
            invite and send a new one.
          </p>
        </Card>
      </main>
    );
  }

  if (invite.data.consumed) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Card>
          <h1 className="text-xl font-bold text-text">
            Invite already used
          </h1>
          <p className="text-sm text-text-soft mt-2">
            This invite has already been accepted. The account is set up —
            just open the app and sign in.
          </p>
        </Card>
      </main>
    );
  }

  // Render the appropriate view.
  if (invite.kind === "family") {
    const f = invite.data as FamilyPreview;
    return (
      <main className="mx-auto max-w-2xl p-6 md:p-8 space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Family invite
          </p>
          <h1 className="text-2xl font-bold text-text">
            {f.inviterName || "A family member"} invited you
          </h1>
          {f.relationship ? (
            <p className="text-sm text-text-soft">
              as a <span className="font-medium">{f.relationship}</span>
              {f.inviteeName ? ` for ${f.inviteeName}` : ""}
            </p>
          ) : null}
          {f.expiresAt ? (
            <p className="text-xs text-text-muted flex items-center gap-1">
              <Calendar size={12} />
              Expires {new Date(f.expiresAt).toLocaleString()}
            </p>
          ) : null}
        </header>

        <Card>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-soft flex items-center justify-center shrink-0">
              <Users size={22} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-text">
                What happens when you accept?
              </h2>
              <ul className="mt-2 text-sm text-text-soft space-y-1 list-disc pl-5">
                <li>You'll be added as a managed profile under {f.inviterName || "their"} account.</li>
                <li>You can record vitals, medicines, and notes for this family member.</li>
                <li>No separate account needed — everything lives in the family.</li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <a
            href={deepLink}
            className="block w-full text-center rounded-2xl bg-accent text-white font-semibold py-4 text-base shadow-sm hover:opacity-95 active:scale-[0.99] transition"
          >
            Open in HealthHub
          </a>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={APP_STORE_URL}
              className="rounded-xl border border-border bg-surface py-2.5 text-sm text-text text-center font-medium hover:bg-surface-soft"
            >
              App Store
            </a>
            <a
              href={PLAY_STORE_URL}
              className="rounded-xl border border-border bg-surface py-2.5 text-sm text-text text-center font-medium hover:bg-surface-soft"
            >
              Play Store
            </a>
          </div>
        </div>

        <p className="text-xs text-text-muted text-center">
          Don't have the app? Install HealthHub first, then tap "Open in
          HealthHub" — your invite will be waiting.
        </p>
      </main>
    );
  }

  // caretaker
  const c = invite.data as CaretakerPreview;
  return (
    <main className="mx-auto max-w-2xl p-6 md:p-8 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-text-muted">
          Caretaker invite
        </p>
        <h1 className="text-2xl font-bold text-text">
          {c.inviterName || "Someone"} invited you to help manage their health
        </h1>
        {c.careRole ? (
          <p className="text-sm text-text-soft">
            Role: <span className="font-medium">{prettifyRole(c.careRole)}</span>
            {c.caretakerName ? ` (you: ${c.caretakerName})` : ""}
          </p>
        ) : null}
        {c.channelHint ? (
          <p className="text-xs text-text-muted flex items-center gap-1">
            <Smartphone size={12} />
            Code was sent to {c.channelHint}
          </p>
        ) : null}
      </header>

      <Card>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-info-soft flex items-center justify-center shrink-0">
            <ShieldCheck size={22} className="text-info" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-text">
              What you'll be able to do
            </h2>
            <ul className="mt-2 text-sm text-text-soft space-y-1 list-disc pl-5">
              <li>View and manage {c.inviterName || "their"} records, medicines, and appointments.</li>
              <li>Add vitals, clinical notes, and family history on their behalf.</li>
              <li>Switch between managing multiple principals in the app.</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <a
          href={deepLink}
          className="block w-full text-center rounded-2xl bg-accent text-white font-semibold py-4 text-base shadow-sm hover:opacity-95 active:scale-[0.99] transition"
        >
          Open in HealthHub
        </a>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={APP_STORE_URL}
            className="rounded-xl border border-border bg-surface py-2.5 text-sm text-text text-center font-medium hover:bg-surface-soft"
          >
            App Store
          </a>
          <a
            href={PLAY_STORE_URL}
            className="rounded-xl border border-border bg-surface py-2.5 text-sm text-text text-center font-medium hover:bg-surface-soft"
          >
            Play Store
          </a>
        </div>
      </div>

      <p className="text-xs text-text-muted text-center">
        You'll enter the 6-digit code you received in the app to complete
        setup.
      </p>
    </main>
  );
}

function prettifyRole(role: string): string {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
