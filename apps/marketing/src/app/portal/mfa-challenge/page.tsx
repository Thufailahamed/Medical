"use client";

// /portal/mfa-challenge — second factor for doctors logging in via the
// web portal. The unified /login page handles the credentials step; if
// the doctor's account has MFA enrolled it returns
// `{ mfaRequired: "verify", mfaToken, expiresAt, user }`. The login
// page stashes the mfaToken in the URL and routes here.
//
// Two modes:
//   - verify (default): accept a 6-digit TOTP code OR a recovery code
//     in XXXX-XXXX-XXXX form. POSTs { mfaToken, code } to /mfa/challenge
//     which mints a full session JWT.
//   - enroll (mfaRequired === "enroll"): no authenticator enrolled yet;
//     route the doctor to the mobile app to scan a QR and complete
//     setup. The portal itself does not yet render an enrollment UI
//     because the otpauth QR is mobile-first and the QR library isn't
//     bundled in the marketing app.
//
// Failure paths:
//   - missing/invalid mfaToken → bounce back to /login
//   - /mfa/challenge 401 → toast + clear code, stay on screen
//   - 5xx → toast + stay on screen
//
// `next` in the URL controls post-success routing. Doctor login lands
// at /portal/dashboard by default (kept here so the auth flow's land()
// helper isn't needed in this file).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Smartphone,
} from "lucide-react";

import { MfaRequiredError, verifyMfaChallenge } from "@/portal/lib/auth";
import { useAuthStore } from "@/portal/stores/auth";
import { friendlyError } from "@/portal/lib/errors";
import { ApiError } from "@/portal/lib/api";

type Mode = "totp" | "recovery";

export default function PortalMfaChallengePage() {
  return (
    <Suspense fallback={<div className="hl-root" />}>
      <PortalMfaChallengeForm />
    </Suspense>
  );
}

function PortalMfaChallengeForm() {
  const params = useSearchParams();
  const router = useRouter();

  const mfaToken = params.get("mfaToken") || "";
  const mfaRequired = (params.get("mfaRequired") || "verify") as
    | "enroll"
    | "verify";
  const nextPath = params.get("next") || "/portal/dashboard";

  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mfaToken) {
      router.replace("/login?port=doctor");
    }
  }, [mfaToken, router]);

  function goBackToLogin() {
    useAuthStore.getState().logout();
    router.replace("/login?port=doctor");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter your code.");
      return;
    }
    if (mode === "totp" && !/^\d{6}$/.test(trimmed)) {
      setError("Authenticator codes are 6 digits.");
      return;
    }
    if (mode === "recovery" && !/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/i.test(trimmed)) {
      setError("Recovery codes look like ABCD-EFGH-JKLM.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await verifyMfaChallenge({
        mfaToken,
        code: trimmed,
      });
      // Mirror the unified login page's role-aware routing.
      const dest =
        nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
          ? nextPath
          : user.role === "doctor"
            ? "/portal/dashboard"
            : "/";
      router.replace(dest);
    } catch (err: unknown) {
      if (err instanceof MfaRequiredError) {
        // Server told us the challenge requires enrollment first.
        router.replace(
          `/portal/mfa-challenge?mfaToken=${encodeURIComponent(
            err.payload.mfaToken,
          )}&mfaRequired=enroll`,
        );
        return;
      }
      if (err instanceof ApiError && err.status === 401) {
        setError(
          "That code didn't match. Try again, or use a recovery code.",
        );
        setCode("");
      } else {
        setError(friendlyError(err));
      }
      setSubmitting(false);
    }
  }

  if (mfaRequired === "enroll") {
    return (
      <div className="hl-root">
        <main className="hl-panel">
          <button
            type="button"
            onClick={goBackToLogin}
            className="hl-back"
            aria-label="Back to sign in"
          >
            <ArrowLeft size={16} />
            <span>Back to sign in</span>
          </button>
          <div className="hl-form-container">
            <div className="hl-header">
              <span className="hl-eyebrow">Two-factor required</span>
              <h2>Set up an authenticator on mobile</h2>
              <p>
                Your doctor account requires two-factor authentication.
                Open the HealthHub mobile app to scan the QR code and
                finish enrollment — then sign in here.
              </p>
            </div>
            <div className="hl-mfa-enroll">
              <Smartphone size={32} aria-hidden />
              <ol>
                <li>Open the HealthHub mobile app.</li>
                <li>Go to <strong>Profile → Two-factor authentication</strong>.</li>
                <li>
                  Scan the QR code with Google Authenticator, 1Password,
                  or any TOTP app.
                </li>
                <li>Return here and sign in again.</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={goBackToLogin}
              className="hl-btn-primary"
            >
              Back to sign in
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="hl-root">
      <main className="hl-panel">
        <button
          type="button"
          onClick={goBackToLogin}
          className="hl-back"
          aria-label="Back to sign in"
        >
          <ArrowLeft size={16} />
          <span>Back to sign in</span>
        </button>

        <div className="hl-form-container">
          <div className="hl-header">
            <span className="hl-eyebrow">Two-factor authentication</span>
            <h2>Enter your code</h2>
            <p>
              Open your authenticator app (Google Authenticator, 1Password,
              Authy) and enter the 6-digit code shown for HealthHub.
            </p>
          </div>

          {error && (
            <div className="hl-error" role="alert">
              <AlertCircle size={16} aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <div className="hl-mode" role="tablist" aria-label="Code type">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "totp"}
              onClick={() => {
                setMode("totp");
                setError(null);
                setCode("");
              }}
              className={mode === "totp" ? "is-active" : ""}
            >
              <Smartphone size={14} />
              Authenticator code
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "recovery"}
              onClick={() => {
                setMode("recovery");
                setError(null);
                setCode("");
              }}
              className={mode === "recovery" ? "is-active" : ""}
            >
              <KeyRound size={14} />
              Recovery code
            </button>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="hl-field">
              <label htmlFor="mfa-code" className="hl-label">
                {mode === "totp" ? "6-digit code" : "Recovery code"}
              </label>
              <div className="hl-input-wrap">
                <span className="hl-input-icon">
                  <KeyRound size={16} />
                </span>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode={mode === "totp" ? "numeric" : "text"}
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={
                    mode === "totp" ? "123 456" : "ABCD-EFGH-JKLM"
                  }
                  maxLength={mode === "totp" ? 6 : 14}
                  className="hl-input hl-input--code"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !mfaToken}
              className="hl-btn-primary"
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <span className="hl-spinner" aria-hidden />
                  <span>Verifying…</span>
                </>
              ) : (
                <>
                  <span>Verify and continue</span>
                </>
              )}
            </button>
          </form>

          <p className="hl-foot-note">
            Lost access? Use a recovery code (one of the ten single-use
            codes generated during setup) or contact your administrator.
          </p>
        </div>
      </main>
    </div>
  );
}