"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  KeyRound,
  RotateCw,
  User,
  Settings,
  CheckCircle2,
  Bell,
  Pill,
  CalendarCheck2,
  FlaskConical,
  FileSignature,
  Syringe,
  Shield,
  Building2,
  Siren,
  Sparkles,
} from "lucide-react";

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
import { cn } from "@/portal/lib/utils";

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

  // ── Notification preferences (parity with mobile) ──────────
  const { data: prefData } = useQuery({
    queryKey: ["notification-preferences", "me"],
    queryFn: () =>
      api<{ preferences: Array<{ type: string; inApp: boolean; push: boolean }> }>(
        "/push/notification-preferences/me"
      ),
  });
  const updatePrefs = useMutation({
    mutationFn: (prefs: Array<{ type: string; inApp: boolean; push: boolean }>) =>
      api("/push/notification-preferences/me", {
        method: "PUT",
        json: { preferences: prefs },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Notification preferences saved");
    },
    onError: (err: Error) => toast.error("Failed", err.message),
  });
  const NOTIF_TYPES: Array<{ key: string; label: string; Icon: typeof Pill; emergency?: boolean }> = [
    { key: "appointment", label: "Appointments", Icon: CalendarCheck2 },
    { key: "medicine", label: "Medicines", Icon: Pill },
    { key: "lab_ready", label: "Lab results", Icon: FlaskConical },
    { key: "prescription", label: "Prescriptions", Icon: FileSignature },
    { key: "vaccination", label: "Vaccinations", Icon: Syringe },
    { key: "insurance", label: "Insurance", Icon: Shield },
    { key: "hospital", label: "Hospital", Icon: Building2 },
    { key: "emergency", label: "Emergency", Icon: Siren, emergency: true },
    { key: "general", label: "General", Icon: Sparkles },
  ];
  const [prefLocal, setPrefLocal] = useState<Record<string, { inApp: boolean; push: boolean }>>(() => {
    const out: Record<string, { inApp: boolean; push: boolean }> = {};
    for (const t of NOTIF_TYPES) out[t.key] = { inApp: true, push: true };
    return out;
  });
  // Hydrate from server once
  const serverPrefs = prefData?.preferences ?? [];
  const [hydrated, setHydrated] = useState(false);
  if (serverPrefs.length > 0 && !hydrated) {
    const next: Record<string, { inApp: boolean; push: boolean }> = { ...prefLocal };
    for (const p of serverPrefs) {
      if (next[p.type]) {
        next[p.type] = { inApp: p.inApp, push: p.push };
      }
    }
    setPrefLocal(next);
    setHydrated(true);
  }
  function setPref(type: string, field: "inApp" | "push", value: boolean) {
    if (type === "emergency" && field === "inApp" && !value) return;
    setPrefLocal((p) => ({ ...p, [type]: { ...p[type], [field]: value } }));
  }
  function savePrefs() {
    const payload = NOTIF_TYPES.map((t) => ({
      type: t.key,
      inApp: prefLocal[t.key]?.inApp ?? true,
      push: prefLocal[t.key]?.push ?? true,
    }));
    updatePrefs.mutate(payload);
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
              <Bell size={14} /> Notification preferences
            </span>
          }
          subtitle="Per-type toggles for in-app and push delivery. Mirrors the mobile settings screen."
        />
        <div className="p-4 flex flex-col gap-3">
          {NOTIF_TYPES.map((t) => {
            const cur = prefLocal[t.key] ?? { inApp: true, push: true };
            const Icon = t.Icon;
            return (
              <div
                key={t.key}
                className="flex items-center gap-3 p-2 rounded-lg border border-border/50"
              >
                <Icon size={16} className="text-text-muted shrink-0" />
                <span className="text-sm font-medium text-text flex-1 truncate">
                  {t.label}
                </span>
                {t.emergency ? (
                  <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wide mr-2">
                    Always on
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPref(t.key, "inApp", !cur.inApp)}
                  disabled={t.emergency}
                  className={cn(
                    "h-7 px-2.5 rounded-md text-xs font-semibold border transition-colors",
                    cur.inApp
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-surface text-text-soft border-border/60",
                    t.emergency && "opacity-60 cursor-not-allowed",
                  )}
                >
                  In-app
                </button>
                <button
                  type="button"
                  onClick={() => setPref(t.key, "push", !cur.push)}
                  className={cn(
                    "h-7 px-2.5 rounded-md text-xs font-semibold border transition-colors",
                    cur.push
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-surface text-text-soft border-border/60",
                  )}
                >
                  Push
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 pb-4 flex justify-end">
          <Button
            leftIcon={<Save size={14} />}
            disabled={updatePrefs.isPending}
            loading={updatePrefs.isPending}
            onClick={savePrefs}
          >
            Save preferences
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
