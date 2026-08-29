"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Shield, Copy, Check, Download, AlertTriangle, KeyRound } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { api, ApiError } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";

interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
}

export default function MfaSetupPage() {
  const router = useRouter();
  const [data, setData] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api<MfaSetupResponse>(patientPaths.auth.mfaSetup(), {
          method: "POST",
        });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to start 2FA setup."
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function downloadRecoveryCodes() {
    if (!data) return;
    const blob = new Blob(
      [
        `Two-factor recovery codes for your HealthHub account\n\nKeep these codes somewhere safe. Each one lets you sign in once if you lose your 2FA device.\n\n${data.recoveryCodes.join("\n")}\n`,
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "healthhub-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onConfirm(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(patientPaths.auth.mfaChallenge(), {
        method: "POST",
        json: { otp: code },
      });
      setDone(true);
      setTimeout(() => router.push("/patient/profile"), 1500);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "That code didn't work. Try the current code from your app."
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
          <Check size={28} aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-text">2FA is on</h2>
        <p className="text-sm text-text-soft">
          Your account is now protected. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/profile"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to profile
      </Link>

      <SectionHeader
        label="Security"
        title="Set up two-factor"
        description="Add an extra step at sign-in. You'll need an authenticator app on your phone."
      />

      {!data ? (
        <Card>
          <p className="text-sm text-text-soft">
            {error ?? "Generating your secret…"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-7">
            <Card>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Shield size={18} aria-hidden className="text-brand" />
                  <h2 className="text-sm font-bold text-text">
                    Step 1 — Scan or copy the secret
                  </h2>
                </div>
                <p className="text-xs text-text-soft">
                  Open Google Authenticator, 1Password, Authy, or any TOTP app,
                  then scan the QR code or paste the secret manually.
                </p>
                <div className="rounded-inner bg-surface-2 p-3">
                  <p className="t-label">Secret</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all font-mono text-sm text-text">
                      {data.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => copy(data.secret)}
                      className="rounded-pill bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <form onSubmit={onConfirm} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} aria-hidden className="text-brand" />
                  <h2 className="text-sm font-bold text-text">
                    Step 2 — Verify a code
                  </h2>
                </div>
                <p className="text-xs text-text-soft">
                  Enter the 6-digit code shown in your authenticator app.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  placeholder="123456"
                  className="h-12 rounded-pill border border-border bg-surface-2 px-4 text-center text-2xl font-bold tracking-widest text-text outline-none focus:border-brand"
                />
                {error ? (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                ) : null}
                <label className="flex items-center gap-2 text-xs text-text-soft">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-brand"
                  />
                  I have saved my recovery codes.
                </label>
                <button
                  type="submit"
                  disabled={busy || code.length !== 6 || !confirmed}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-pill bg-brand px-5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Verifying…" : "Enable 2FA"}
                </button>
              </form>
            </Card>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-5">
            <Card accent="amber">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} aria-hidden className="text-amber-600" />
                  <h3 className="text-sm font-bold text-text">
                    Recovery codes
                  </h3>
                </div>
                <p className="text-xs text-text-soft">
                  Save these one-time codes in a safe place. If you lose your
                  phone, you can use one to sign in.
                </p>
                <ul className="grid grid-cols-2 gap-1.5 rounded-inner bg-surface-2 p-3 font-mono text-xs">
                  {data.recoveryCodes.map((c) => (
                    <li key={c} className="text-text">
                      {c}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={downloadRecoveryCodes}
                  className="inline-flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-soft"
                >
                  <Download size={14} aria-hidden /> Download codes
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
