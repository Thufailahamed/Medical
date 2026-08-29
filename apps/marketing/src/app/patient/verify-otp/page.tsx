"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, KeyRound, Lock, Loader2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { api, ApiError } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";
import { useAuthStore, type AuthUser } from "@/portal/stores/auth";

function VerifyOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const identifier = params.get("identifier") || "";
  const mode = params.get("mode") || "register"; // register | reset | mfa

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "reset") {
        await api(patientPaths.auth.reset(), {
          method: "POST",
          json: {
            identifier,
            otp,
            newPassword,
          },
        });
        router.push("/patient/login");
        return;
      }

      if (mode === "mfa") {
        await api(patientPaths.auth.mfaChallenge(), {
          method: "POST",
          json: { otp, identifier },
        });
        // The auth store is updated by the api wrapper on success.
        router.push("/patient");
        return;
      }

      // register
      const res = await api<{
        user: AuthUser;
        session: { access_token: string; refresh_token: string };
      }>(patientPaths.auth.verifyOtp(), {
        method: "POST",
        json: {
          identifier,
          otp,
        },
      });
      useAuthStore.getState().setSession({
        token: res.session.access_token,
        user: res.user,
        refreshToken: res.session.refresh_token,
      });
      router.push("/patient");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not verify your code. Please try again."
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
            href={
              mode === "reset"
                ? "/patient/forgot-password"
                : mode === "mfa"
                  ? "/patient/mfa/challenge"
                  : "/patient/register"
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
          >
            <ChevronLeft size={14} aria-hidden /> Back
          </Link>
          <p className="t-label">
            {mode === "reset"
              ? "Reset password"
              : mode === "mfa"
                ? "Two-factor"
                : "Verify your account"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            {mode === "reset"
              ? "Enter your reset code"
              : mode === "mfa"
                ? "Enter your 2FA code"
                : "Enter your verification code"}
          </h1>
          <p className="text-sm text-text-soft">
            We sent a 6-digit code to{" "}
            <span className="font-semibold">{identifier}</span>. Enter it below
            to continue.
          </p>

          <div>
            <label htmlFor="otp" className="t-label block">
              6-digit code
            </label>
            <div className="relative mt-2">
              <KeyRound
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                required
                className="h-12 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-center text-2xl font-bold tracking-widest text-text outline-none focus:border-brand"
              />
            </div>
          </div>

          {mode === "reset" ? (
            <div>
              <label htmlFor="new-password" className="t-label block">
                New password
              </label>
              <div className="relative mt-2">
                <Lock
                  size={14}
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || otp.length !== 6}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-brand text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Verifying…
              </>
            ) : (
              "Verify and continue"
            )}
          </button>
        </form>
      </Card>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  );
}
