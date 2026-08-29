"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Shield, KeyRound, Loader2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { api, ApiError } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";
import { useAuthStore, type AuthUser } from "@/portal/stores/auth";

export default function MfaChallengePage() {
  const router = useRouter();
  const params = useSearchParams();
  const identifier = params.get("identifier") || "";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{
        user?: AuthUser;
        session?: { access_token: string; refresh_token: string };
      }>(patientPaths.auth.mfaChallenge(), {
        method: "POST",
        json: { identifier, otp: code },
      });
      if (res.session && res.user) {
        useAuthStore.getState().setSession({
          token: res.session.access_token,
          user: res.user,
          refreshToken: res.session.refresh_token,
        });
      }
      router.push("/patient");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "That code didn't work. Try again or use a recovery code."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Link
            href="/login?port=patient"
            className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
          >
            <ChevronLeft size={14} aria-hidden /> Back to sign in
          </Link>
          <div className="flex items-center gap-2">
            <Shield size={18} aria-hidden className="text-brand" />
            <p className="t-label">Two-factor authentication</p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Enter your 2FA code
          </h1>
          <p className="text-sm text-text-soft">
            Open your authenticator app and enter the 6-digit code for
            HealthHub.
          </p>
          <div>
            <label htmlFor="code" className="t-label block">
              6-digit code
            </label>
            <div className="relative mt-2">
              <KeyRound
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                placeholder="123456"
                className="h-12 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-center text-2xl font-bold tracking-widest text-text outline-none focus:border-brand"
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-brand text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Verifying…
              </>
            ) : (
              "Verify"
            )}
          </button>
          <Link
            href={`/patient/verify-otp?identifier=${encodeURIComponent(identifier)}&mode=mfa`}
            className="text-center text-xs font-semibold text-text-soft hover:text-brand"
          >
            Lost your device? Use a recovery code
          </Link>
        </form>
      </Card>
    </main>
  );
}
