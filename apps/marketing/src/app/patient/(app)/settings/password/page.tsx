"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Lock, Check, Eye, EyeOff } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { changePassword } from "@/portal/lib/auth";
import { useAuthStore } from "@/portal/stores/auth";

export default function ChangePasswordPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setDone(true);
      // Sign the user out so they re-authenticate with the new password.
      setTimeout(() => {
        logout();
        router.push("/patient/login");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not change password."
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-1 py-12 sm:px-2">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
          <Check size={28} aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-text">Password updated</h2>
        <p className="text-sm text-text-soft">Signing you out so you can sign back in with your new password…</p>
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
        title="Change password"
        description="Use at least 8 characters with a mix of letters, numbers, and symbols."
      />

      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="current" className="t-label block">
              Current password
            </label>
            <div className="relative mt-2">
              <Lock
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="current"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-10 text-sm text-text outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="new" className="t-label block">
              New password
            </label>
            <div className="relative mt-2">
              <Lock
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="new"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-10 text-sm text-text outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="t-label block">
              Confirm new password
            </label>
            <div className="relative mt-2">
              <Lock
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="confirm"
                type={showNew ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
            <Link
              href="/patient/profile"
              className="inline-flex items-center gap-1.5 rounded-pill border border-border px-5 py-2.5 text-sm font-semibold text-text-soft"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
