"use client";

// portal/components/admin/StepUpModal.tsx
//
// Modal that intercepts step-up requests. Listens on a global
// listener or can be triggered manually. Opens an assertion flow
// with navigator.credentials.get() then stores the returned
// step-up token in sessionStorage so subsequent requests pass
// through `requirePasskeyFresh` automatically.
//
// Usage in the admin layout: mount <StepUpModal /> once.
// Listens for the `admin:step_up_required` window event that
// `adminApi` fires before throwing.

import { useEffect, useState } from "react";
import { Fingerprint, ShieldAlert, KeyRound, CheckCircle2 } from "lucide-react";
import { Modal } from "@/portal/components/ui/Modal";
import { Button } from "@/portal/components/ui/Button";
import { adminApi, setStepUpToken } from "@/portal/lib/admin-api";
import { getPasskey, createPasskey, isWebAuthnSupported } from "@/portal/lib/webauthn";

export function StepUpModal() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = isWebAuthnSupported();

  useEffect(() => {
    function onNeedStepUp() {
      setError(null);
      setNeedsEnrollment(false);
      setOpen(true);
    }
    window.addEventListener("admin:step_up_required", onNeedStepUp);
    return () => window.removeEventListener("admin:step_up_required", onNeedStepUp);
  }, []);

  async function runAssertion() {
    if (!supported) {
      setError("This browser doesn't support WebAuthn. Try Chrome, Safari, or Edge.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const opts = await adminApi<any>("/admin/webauthn/auth/options", {
        method: "POST",
        json: {},
      });
      const credential = await getPasskey(opts);
      const res = await adminApi<{ ok: boolean; stepUpToken: string }>(
        "/admin/webauthn/auth/verify",
        { method: "POST", json: credential },
      );
      setStepUpToken(res.stepUpToken);
      setOpen(false);
      // Notify any in-flight retry to wake up.
      window.dispatchEvent(new CustomEvent("admin:step_up_resolved"));
    } catch (e: any) {
      const msg = e?.message || "";
      if (e?.code === "no_passkeys" || msg.toLowerCase().includes("no passkey")) {
        setNeedsEnrollment(true);
        setError("No passkey is enrolled for your admin account yet. Click 'Register this device' below to set up Touch ID / Passkey.");
      } else {
        setError(msg || "Passkey assertion failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runEnrollment() {
    if (!supported) {
      setError("WebAuthn is not supported in this browser.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const opts = await adminApi<any>("/admin/webauthn/register/options", {
        method: "POST",
        json: {},
      });
      const credential = await createPasskey(opts, "Admin Touch ID");
      const res = await adminApi<{ ok: boolean; id: string; stepUpToken: string }>(
        "/admin/webauthn/register/verify",
        { method: "POST", json: credential },
      );
      setStepUpToken(res.stepUpToken);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("admin:step_up_resolved"));
    } catch (e: any) {
      setError(e?.message ?? "Passkey registration failed");
    } finally {
      setBusy(false);
    }
  }

  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".localhost"));

  async function runDevStepUp() {
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi<{ ok: boolean; stepUpToken: string }>(
        "/admin/webauthn/dev-stepup",
        { method: "POST", json: {} }
      );
      setStepUpToken(res.stepUpToken);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("admin:step_up_resolved"));
    } catch (e: any) {
      setError(e?.message ?? "Dev step-up failed");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("admin:step_up_cancelled"));
  }

  return (
    <Modal
      open={open}
      onClose={cancel}
      title={
        <span className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-500" />
          Confirm with passkey
        </span>
      }
      subtitle="Administrative actions require a fresh passkey assertion."
      size="sm"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <div>
            {isLocal ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={runDevStepUp}
                disabled={busy}
                className="text-xs text-amber-700 hover:bg-amber-50 cursor-pointer"
                title="Bypass passkey challenge for local testing"
              >
                ⚡ Dev Bypass
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={cancel} className="cursor-pointer">
              Cancel
            </Button>
            {needsEnrollment ? (
              <Button
                variant="primary"
                size="sm"
                onClick={runEnrollment}
                disabled={busy || !supported}
                className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                <KeyRound size={14} className="mr-1" />
                {busy ? "Registering Touch ID…" : "Register this device"}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={runAssertion}
                disabled={busy || !supported}
                className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                <Fingerprint size={14} className="mr-1" />
                {busy ? "Touch your authenticator…" : "Use passkey"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-xs text-slate-600">
        <p>
          Tap your security key, scan your fingerprint (Touch ID), or use Face ID to confirm this action.
          Once confirmed, your passkey authorization remains valid for <strong>5 minutes</strong> across all admin operations.
        </p>

        {needsEnrollment ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5 text-amber-800">
              <KeyRound size={14} /> No passkey registered yet
            </p>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Click <strong>&quot;Register this device&quot;</strong> to link your Mac Touch ID / Windows Hello in 1 click, or use <strong>&quot;Dev Bypass&quot;</strong> to authorize immediately.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-2.5 text-xs break-words">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}