"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, KeyRound, RotateCw, User, Settings } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import { toast } from "@/portal/components/ui/Toast";
import { useAuthStore } from "@/portal/stores/auth";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";

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

  const rotateKey = useMutation({
    mutationFn: () => api(`/signature/rotate`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Signing key rotated");
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

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
          subtitle="Rotates the Ed25519 key used to sign prescriptions and clinical records."
        />
        <div className="p-4 flex items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<RotateCw size={14} />}
            disabled={rotateKey.isPending}
            loading={rotateKey.isPending}
            onClick={() => {
              if (confirm("Rotate signing key? Existing signatures remain valid.")) {
                rotateKey.mutate();
              }
            }}
          >
            Rotate signing key
          </Button>
        </div>
      </Card>
    </div>
  );
}
