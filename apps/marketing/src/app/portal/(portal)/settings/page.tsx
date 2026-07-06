"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, KeyRound, RotateCw, User, Settings, CheckCircle2 } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import { Modal } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { useAuthStore } from "@/portal/stores/auth";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { useRotateSigningKey } from "@/portal/hooks/usePrescription";
import { formatDateTime } from "@/portal/lib/format";

export default function SettingsPage() {
  const t = useT();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [slmc, setSlmc] = useState(user?.slmcNumber ?? "");
  const [specialization, setSpecialization] = useState(
    (user as any)?.specialization ?? ""
  );

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");

  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateResult, setRotateResult] = useState<{
    keyId: string;
    createdAt: string;
    note: string;
  } | null>(null);

  const saveProfile = useMutation({
    mutationFn: () =>
      api(`/auth/me`, {
        method: "PATCH",
        json: { name, email, phone, slmcNumber: slmc, specialization },
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const changePwd = useMutation({
    mutationFn: () =>
      api(`/auth/change-password`, {
        method: "POST",
        json: { oldPassword: oldPwd, newPassword: newPwd },
      }),
    onSuccess: () => {
      toast.success("Password changed");
      setOldPwd("");
      setNewPwd("");
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  // Was previously wired to `/signature/rotate` (a 404 path).
  // New route: POST /doctor/regenerate-signing-key — same handler the
  // mobile composer used to call via useApi.ts.
  const rotateKey = useRotateSigningKey();

  function openRotate() {
    setRotateOpen(true);
  }

  async function confirmRotate() {
    try {
      const res = await rotateKey.mutateAsync();
      setRotateResult({
        keyId: res.keyId,
        createdAt: res.createdAt,
        note: res.note,
      });
      toast.success("Signing key rotated");
    } catch (err: any) {
      toast.error("Failed to rotate key", err?.message);
    }
  }

  function closeRotate() {
    setRotateOpen(false);
    setRotateResult(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        icon={<Settings size={18} className="text-slate-600" />}
      />

      <Card padding={false} className="rounded-2xl border-border/50">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <User size={14} /> Profile
            </span>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Specialization"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="SLMC registration number"
            value={slmc}
            onChange={(e) => setSlmc(e.target.value)}
            placeholder="e.g. SLMC-12345"
          />
        </div>
        <div className="px-4 pb-4 flex justify-end">
          <Button
            leftIcon={<Save size={14} />}
            disabled={saveProfile.isPending}
            loading={saveProfile.isPending}
            onClick={() => saveProfile.mutate()}
          >
            Save profile
          </Button>
        </div>
      </Card>

      <Card padding={false} className="rounded-2xl border-border/50">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <KeyRound size={14} /> Password
            </span>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          <Input
            label="Current password"
            type="password"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
          />
          <Input
            label="New password"
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
          />
        </div>
        <div className="px-4 pb-4 flex justify-end">
          <Button
            leftIcon={<Save size={14} />}
            disabled={!oldPwd || !newPwd || changePwd.isPending}
            loading={changePwd.isPending}
            onClick={() => changePwd.mutate()}
          >
            Update password
          </Button>
        </div>
      </Card>

      <Card padding={false} className="rounded-2xl border-border/50">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <RotateCw size={14} /> Signing key
            </span>
          }
          subtitle="Rotates the RSA-2048 key used to sign prescriptions. Already-signed prescriptions keep verifying against the public key denormalised on their signature row."
        />
        <div className="p-4 flex items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<RotateCw size={14} />}
            onClick={openRotate}
          >
            Rotate signing key
          </Button>
        </div>
      </Card>

      <Modal
        open={rotateOpen}
        onClose={closeRotate}
        title="Rotate signing key"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={closeRotate}>
              {t("common.cancel")}
            </Button>
            {!rotateResult ? (
              <Button
                leftIcon={<RotateCw size={14} />}
                loading={rotateKey.isPending}
                onClick={confirmRotate}
              >
                Rotate
              </Button>
            ) : (
              <Button
                leftIcon={<CheckCircle2 size={14} />}
                onClick={closeRotate}
              >
                Done
              </Button>
            )}
          </div>
        }
      >
        {rotateResult ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-success text-sm font-medium">
              <CheckCircle2 size={16} />
              Key rotated
            </div>
            <div className="text-xs text-text-soft">
              <div>
                <span className="text-text-muted">New key id: </span>
                <span className="font-mono">{rotateResult.keyId}</span>
              </div>
              <div>
                <span className="text-text-muted">Created at: </span>
                {formatDateTime(rotateResult.createdAt)}
              </div>
              <div className="mt-2">{rotateResult.note}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-soft">
              Generate a new RSA-2048 signing key. Already-signed
              prescriptions stay verifiable because their signature
              rows denormalise the previous public key. New signatures
              will use the new key.
            </p>
            <p className="text-xs text-text-muted">
              This action is recorded in the audit log.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
