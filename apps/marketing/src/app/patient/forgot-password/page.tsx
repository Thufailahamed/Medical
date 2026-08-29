"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, ChevronLeft, Check, KeyRound } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { api, ApiError } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input = identifier.includes("@")
        ? { email: identifier }
        : { phone: identifier };
      await api(patientPaths.auth.forgot(), {
        method: "POST",
        json: input,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not send the reset code. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
              <Check size={28} aria-hidden />
            </div>
            <h1 className="text-2xl font-bold text-text">Check your inbox</h1>
            <p className="text-sm text-text-soft">
              If an account exists for <span className="font-semibold">{identifier}</span>,
              we sent a reset code. It expires in 15 minutes.
            </p>
            <Link
              href={`/patient/verify-otp?identifier=${encodeURIComponent(identifier)}&mode=reset`}
              className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white"
            >
              <KeyRound size={14} aria-hidden /> Enter reset code
            </Link>
            <Link
              href="/login?port=patient"
              className="text-xs font-semibold text-text-soft hover:text-brand"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Link
              href="/login?port=patient"
              className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
            >
              <ChevronLeft size={14} aria-hidden /> Back to sign in
            </Link>
            <p className="t-label">Patient portal</p>
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Reset your password
            </h1>
            <p className="text-sm text-text-soft">
              Enter the email or phone you used at signup. We'll send you a
              one-time code to set a new password.
            </p>
            <div>
              <label htmlFor="identifier" className="t-label block">
                Email or phone
              </label>
              <div className="relative mt-2">
                {identifier.includes("@") ? (
                  <Mail
                    size={14}
                    aria-hidden
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                ) : (
                  <Phone
                    size={14}
                    aria-hidden
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                )}
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. name@example.com or 0771234567"
                  required
                  autoComplete="username"
                  className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
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
              disabled={busy || !identifier}
              className="h-12 w-full rounded-pill bg-brand text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset code"}
            </button>
          </form>
        )}
      </Card>
    </main>
  );
}
