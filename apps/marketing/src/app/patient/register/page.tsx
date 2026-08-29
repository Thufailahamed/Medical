"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Phone, Lock, User, Shield, ChevronLeft } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { api, ApiError } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";
import { useAuthStore, type AuthUser } from "@/portal/stores/auth";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/patient";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"details" | "verify">("details");
  const [otp, setOtp] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setError("Please accept the terms to continue.");
      return;
    }

    setBusy(true);
    try {
      await api<{ message: string }>(patientPaths.auth.register(), {
        method: "POST",
        json: {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          password,
          dateOfBirth: dateOfBirth || null,
          gender: gender || null,
        },
      });
      setStep("verify");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not create your account. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{
        user: AuthUser;
        session: { access_token: string; refresh_token: string };
      }>(patientPaths.auth.verifyOtp(), {
        method: "POST",
        json: {
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          otp,
        },
      });
      useAuthStore.getState().setSession({
        token: res.session.access_token,
        user: res.user,
        refreshToken: res.session.refresh_token,
      });
      router.replace(next.startsWith("/patient") ? next : "/patient");
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

  if (step === "verify") {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <form onSubmit={onVerify} className="flex flex-col gap-4">
            <Link
              href="/patient/register"
              onClick={(e) => {
                e.preventDefault();
                setStep("details");
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
            >
              <ChevronLeft size={14} aria-hidden /> Back
            </Link>
            <p className="t-label">Verify your account</p>
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Enter the code
            </h1>
            <p className="text-sm text-text-soft">
              We sent a 6-digit code to{" "}
              {email ? email : phone}. Enter it below to confirm.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              required
              className="h-12 w-full rounded-pill border border-border bg-surface-2 px-4 text-center text-2xl font-bold tracking-widest text-text outline-none focus:border-brand"
            />
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy || otp.length !== 6}
              className="h-12 w-full rounded-pill bg-brand text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify and continue"}
            </button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="t-label">Patient portal</p>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Create your account
          </h1>
          <p className="text-sm text-text-soft">
            Already have one?{" "}
            <Link
              href="/patient/login"
              className="font-semibold text-brand hover:underline"
            >
              Sign in
            </Link>
          </p>

          <div>
            <label htmlFor="name" className="t-label block">
              Full name
            </label>
            <div className="relative mt-2">
              <User
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="t-label block">
                Email
              </label>
              <div className="relative mt-2">
                <Mail
                  size={14}
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
                />
              </div>
            </div>
            <div>
              <label htmlFor="phone" className="t-label block">
                Phone
              </label>
              <div className="relative mt-2">
                <Phone
                  size={14}
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dob" className="t-label block">
                Date of birth
              </label>
              <input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>
            <div>
              <label htmlFor="gender" className="t-label block">
                Gender
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="t-label block">
              Password
            </label>
            <div className="relative mt-2">
              <Lock
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="t-label block">
              Confirm password
            </label>
            <div className="relative mt-2">
              <Lock
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-text-soft">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-brand"
            />
            <span>
              I accept the{" "}
              <Link
                href="/terms"
                className="font-semibold text-brand hover:underline"
              >
                terms of service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-semibold text-brand hover:underline"
              >
                privacy policy
              </Link>
              .
            </span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-pill bg-brand text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-xs text-text-muted">
            <Shield size={11} className="inline-block align-[-2px]" /> Your data
            is encrypted in transit and at rest.
          </p>
        </form>
      </Card>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
