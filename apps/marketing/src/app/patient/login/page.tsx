"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { login } from "@/portal/lib/auth";
import { ApiError } from "@/portal/lib/api";

/**
 * Patient sign-in.
 *
 * Writes into the SAME auth store the clinician portal uses
 * (`@/portal/stores/auth`), so a session started at /portal/login is
 * already valid here and vice versa. `login()` accepts either an
 * email address or a phone number.
 */
function PatientLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/patient";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input = identifier.includes("@")
        ? { email: identifier, password }
        : { phone: identifier, password };
      const user = await login(input);
      if (user.role !== "patient") {
        router.replace("/patient/403");
        return;
      }
      router.replace(next.startsWith("/patient") ? next : "/patient");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not sign you in. Check your details and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function onDevLogin() {
    setError(null);
    setBusy(true);
    try {
      const user = await login({
        email: "dev-patient@healthhub.local",
        password: "dev",
      });
      if (user.role !== "patient") {
        router.replace("/patient/403");
        return;
      }
      router.replace(next.startsWith("/patient") ? next : "/patient");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Dev test login failed. Please ensure the backend is running."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-surface p-10"
        style={{
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <p className="t-label">Patient portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-text">
          Sign in
        </h1>

        <label className="mt-8 block t-label" htmlFor="identifier">
          Email or phone
        </label>
        <input
          id="identifier"
          value={identifier}
          placeholder="e.g. dev-patient@healthhub.local or 0771234567"
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          required
          className="mt-2 h-12 w-full bg-surface-2 px-4 text-sm text-text outline-none"
          style={{ borderRadius: "var(--radius-inner)" }}
        />

        <label className="mt-5 block t-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-2 h-12 w-full bg-surface-2 px-4 text-sm text-text outline-none"
          style={{ borderRadius: "var(--radius-inner)" }}
        />

        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-7 h-12 w-full bg-ink text-sm font-semibold text-white transition-shadow hover:shadow-float disabled:opacity-60 cursor-pointer"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={onDevLogin}
          disabled={busy}
          className="mt-3 h-12 w-full border border-dashed border-teal-500/60 bg-teal-50/50 text-sm font-semibold text-teal-800 transition hover:bg-teal-100/70 disabled:opacity-60 cursor-pointer"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          🛠️ Dev Test Login (Auto-seed)
        </button>
      </form>
    </main>
  );
}

export default function PatientLoginPage() {
  return (
    <Suspense fallback={null}>
      <PatientLoginForm />
    </Suspense>
  );
}