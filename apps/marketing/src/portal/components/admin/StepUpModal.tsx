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
import { Fingerprint, ShieldAlert } from "lucide-react";
import { Modal } from "@/portal/components/ui/Modal";
import { Button } from "@/portal/components/ui/Button";
import { adminApi, setStepUpToken } from "@/portal/lib/admin-api";
import { getPasskey, isWebAuthnSupported } from "@/portal/lib/webauthn";

export function StepUpModal() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = isWebAuthnSupported();

  useEffect(() => {
    function onNeedStepUp() {
      setError(null);
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
      setError(e?.message ?? "Passkey assertion failed");
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
      subtitle="Destructive admin actions require a fresh passkey assertion."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={cancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={runAssertion}
            disabled={busy || !supported}
          >
            <Fingerprint size={14} className="mr-1" />
            {busy ? "Touch your authenticator…" : "Use passkey"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-soft">
          Tap your security key, scan your fingerprint, or use Face ID to confirm this action.
          The passkey check covers the next 5 minutes of admin operations.
        </p>
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-2 text-sm">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}