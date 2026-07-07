"use client";

// portal/components/admin/PasskeyManager.tsx
//
// Show enrolled credentials + register a new one. Shown on the
// admin Settings → Security section. The actual WebAuthn ceremony
// uses navigator.credentials in `lib/webauthn.ts`; we only call
// the API endpoints here.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { adminApi, adminQk, setStepUpToken } from "@/portal/lib/admin-api";
import { createPasskey, isWebAuthnSupported } from "@/portal/lib/webauthn";
import { toast } from "@/portal/components/ui/Toast";

type Credential = {
  id: string;
  deviceName: string;
  lastUsedAt: string | null;
  createdAt: string;
};

type Status = { enrolled: boolean; credentials: Credential[] };

export function PasskeyManager() {
  const qc = useQueryClient();
  const [deviceName, setDeviceName] = useState("");
  const supported = isWebAuthnSupported();

  const { data, isLoading } = useQuery({
    queryKey: adminQk.passkeys(),
    queryFn: () => adminApi<Status>("/admin/webauthn/status"),
  });

  const register = useMutation({
    mutationFn: async (name: string) => {
      if (!supported) throw new Error("WebAuthn is not supported in this browser");
      const opts = await adminApi<any>("/admin/webauthn/register/options", {
        method: "POST",
        json: {},
      });
      const credential = await createPasskey(opts, name);
      return adminApi<{ ok: boolean; id: string; stepUpToken: string }>(
        "/admin/webauthn/register/verify",
        { method: "POST", json: credential },
      );
    },
    onSuccess: (res) => {
      toast.success("Passkey added");
      setStepUpToken(res.stepUpToken);
      setDeviceName("");
      qc.invalidateQueries({ queryKey: adminQk.passkeys() });
    },
    onError: (e: any) => toast.error("Could not add passkey", e?.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      adminApi(`/admin/webauthn/credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Passkey removed");
      qc.invalidateQueries({ queryKey: adminQk.passkeys() });
    },
    onError: (e: any) => toast.error("Could not remove passkey", e?.message),
  });

  if (isLoading) return <p className="text-sm text-text-soft">Loading…</p>;

  const creds = data?.credentials ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-emerald-500" />
        <p className="text-base font-semibold">Passkey step-up</p>
        {creds.length > 0 ? <Pill tone="success">enrolled</Pill> : <Pill tone="warn">not enrolled</Pill>}
      </div>
      <p className="text-xs text-text-muted">
        Passkeys act as a second factor for destructive admin actions (deleting users, marking payouts,
        bulk delete). Your normal email + password login still works for everything else.
      </p>

      {!supported ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm">
          This browser does not support WebAuthn. Use a recent Chrome, Safari, or Edge with
          Touch ID, Windows Hello, or an enrolled security key.
        </div>
      ) : null}

      {creds.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {creds.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3"
            >
              <KeyRound size={18} className="text-text-soft" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{c.deviceName}</p>
                <p className="text-[11px] text-text-muted">
                  Added {new Date(c.createdAt).toLocaleDateString()}
                  {c.lastUsedAt ? ` · last used ${new Date(c.lastUsedAt).toLocaleString()}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => remove.mutate(c.id)}
                disabled={remove.isPending || creds.length === 1}
                title={
                  creds.length === 1
                    ? "Keep at least one passkey enrolled"
                    : "Remove this passkey"
                }
              >
                <Trash2 size={14} className="mr-1" />Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-text-muted">Device name</label>
          <input
            type="text"
            className="w-full mt-1 p-2 text-sm border border-border rounded-lg bg-surface-2"
            placeholder="MacBook Touch ID"
            value={deviceName}
            maxLength={60}
            onChange={(e) => setDeviceName(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          onClick={() => register.mutate(deviceName.trim() || "Passkey")}
          disabled={register.isPending || !supported}
        >
          <Fingerprint size={14} className="mr-1" />
          {register.isPending ? "Awaiting Touch ID…" : "Add passkey"}
        </Button>
      </div>
    </div>
  );
}