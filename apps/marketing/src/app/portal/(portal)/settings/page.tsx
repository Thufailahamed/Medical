"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Save, KeyRound, RotateCw, User, Settings, CheckCircle2, Bell, Pill,
  CalendarCheck2, FlaskConical, FileSignature, Syringe, Shield, Building2,
  Siren, Sparkles, Video, BadgeCheck, Eye, EyeOff, UserPlus,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import { Pill as Tag } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Modal } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { useAuthStore } from "@/portal/stores/auth";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { useRotateSigningKey } from "@/portal/hooks/usePrescription";
import { formatDateTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface DoctorProfile {
  specialization: string | null;
  slmcRegistrationNo: string | null;
  slmcVerifiedAt: string | null;
  qualification: string | null;
  experience: number | null;
  consultationFee: number | null;
  telemedicineEnabled: boolean;
}
interface ProfileResp {
  doctor: DoctorProfile;
  user: { id: string; name: string; email: string | null; phone: string | null };
}

interface ProfileForm {
  name: string; email: string; phone: string;
  specialization: string; slmcRegistrationNo: string;
  qualification: string; experience: string; consultationFee: string;
  telemedicineEnabled: boolean;
}

const formFrom = (p: ProfileResp): ProfileForm => ({
  name: p.user.name ?? "",
  email: p.user.email ?? "",
  phone: p.user.phone ?? "",
  specialization: p.doctor.specialization ?? "",
  slmcRegistrationNo: p.doctor.slmcRegistrationNo ?? "",
  qualification: p.doctor.qualification ?? "",
  experience: p.doctor.experience != null ? String(p.doctor.experience) : "",
  consultationFee: p.doctor.consultationFee != null ? String(p.doctor.consultationFee) : "",
  telemedicineEnabled: !!p.doctor.telemedicineEnabled,
});

const NOTIF_TYPES: Array<{ key: string; labelKey: string; Icon: typeof Pill; emergency?: boolean }> = [
  { key: "appointment", labelKey: "settings.notif.appointment", Icon: CalendarCheck2 },
  { key: "medicine", labelKey: "settings.notif.medicine", Icon: Pill },
  { key: "lab_ready", labelKey: "settings.notif.lab_ready", Icon: FlaskConical },
  { key: "prescription", labelKey: "settings.notif.prescription", Icon: FileSignature },
  { key: "vaccination", labelKey: "settings.notif.vaccination", Icon: Syringe },
  { key: "insurance", labelKey: "settings.notif.insurance", Icon: Shield },
  { key: "hospital", labelKey: "settings.notif.hospital", Icon: Building2 },
  { key: "hospital_request", labelKey: "settings.notif.hospital_request", Icon: UserPlus },
  { key: "emergency", labelKey: "settings.notif.emergency", Icon: Siren, emergency: true },
  { key: "general", labelKey: "settings.notif.general", Icon: Sparkles },
];

function Toggle({ checked, onChange, disabled, label }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "h-5 w-9 rounded-full relative transition-colors shrink-0",
        checked ? "bg-emerald-500" : "bg-slate-300",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className={cn(
        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
        checked ? "left-[18px]" : "left-0.5"
      )} />
    </button>
  );
}

export default function SettingsPage() {
  const t = useT();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // Draft overlay: local edits sit on top of the server profile until
  // a save lands — same pattern as the availability editor.
  const [draft, setDraft] = useState<ProfileForm | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["doctor-portal", "profile"],
    queryFn: () => api<ProfileResp>("/doctor-portal/profile"),
  });

  const serverForm = profile ? formFrom(profile) : null;
  const form = draft ?? serverForm;
  const dirty = !!serverForm && !!draft && JSON.stringify(draft) !== JSON.stringify(serverForm);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setDraft((cur) => ({ ...(cur ?? serverForm!), [k]: v }));

  const saveProfile = useMutation({
    mutationFn: (f: ProfileForm) =>
      api<ProfileResp>("/doctor-portal/profile", {
        method: "PATCH",
        json: {
          name: f.name,
          email: f.email || null,
          phone: f.phone || null,
          specialization: f.specialization,
          slmcRegistrationNo: f.slmcRegistrationNo || null,
          qualification: f.qualification || null,
          experience: f.experience === "" ? null : Number(f.experience),
          consultationFee: f.consultationFee === "" ? null : Number(f.consultationFee),
          telemedicineEnabled: f.telemedicineEnabled,
        },
      }),
    onSuccess: (res) => {
      toast.success(t("settings.profileUpdated"));
      setDraft(null);
      qc.setQueryData(["doctor-portal", "profile"], res);
      if (user) setUser({ ...user, name: res.user.name, email: res.user.email, phone: res.user.phone });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (err: unknown) =>
      toast.error(t("toast.error"), err instanceof Error ? err.message : undefined),
  });

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  const changePwd = useMutation({
    mutationFn: () =>
      api(`/auth/change-password`, {
        method: "POST",
        json: { currentPassword: oldPwd, newPassword: newPwd },
      }),
    onSuccess: () => {
      toast.success(t("settings.passwordChanged"));
      setOldPwd(""); setNewPwd(""); setConfirmPwd(""); setPwdErr(null);
    },
    onError: (err: unknown) =>
      toast.error(t("toast.error"), err instanceof Error ? err.message : undefined),
  });

  function submitPassword() {
    if (newPwd.length < 8) { setPwdErr(t("settings.passwordTooShort")); return; }
    if (newPwd !== confirmPwd) { setPwdErr(t("settings.passwordMismatch")); return; }
    setPwdErr(null);
    changePwd.mutate();
  }

  const rotateKey = useRotateSigningKey();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateResult, setRotateResult] = useState<{ keyId: string; createdAt: string; note: string } | null>(null);

  async function confirmRotate() {
    try {
      const res = await rotateKey.mutateAsync();
      setRotateResult({ keyId: res.keyId, createdAt: res.createdAt, note: res.note });
      toast.success(t("settings.keyRotated"));
    } catch (err) {
      toast.error(t("toast.error"), err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        icon={<Settings size={18} className="text-slate-600" />}
      />

      {/* ─── Profile ─── */}
      <Card padding={false} className="rounded-2xl overflow-hidden">
        <div className="px-5 pt-4">
          <CardHeader
            title={<span className="inline-flex items-center gap-1.5"><User size={14} /> {t("settings.profile")}</span>}
            right={dirty ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                {t("settings.unsaved")}
              </span>
            ) : undefined}
          />
        </div>
        {isLoading || !form ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
              <Input label={t("settings.name")} value={form.name} onChange={(e) => set("name", e.target.value)} />
              <Input
                label={t("settings.specialty")}
                value={form.specialization}
                onChange={(e) => set("specialization", e.target.value)}
              />
              <Input label={t("settings.email")} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              <Input label={t("settings.phone")} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              <div>
                <Input
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      {t("settings.slmc")}
                      {profile?.doctor.slmcVerifiedAt && (
                        <Tag tone="success" className="!py-0"><BadgeCheck size={10} /> {t("settings.verified")}</Tag>
                      )}
                    </span>
                  }
                  hint={t("settings.slmcHelp")}
                  value={form.slmcRegistrationNo}
                  onChange={(e) => set("slmcRegistrationNo", e.target.value)}
                  placeholder="e.g. SLMC-12345"
                />
              </div>
              <Input
                label={t("settings.qualifications")}
                value={form.qualification}
                onChange={(e) => set("qualification", e.target.value)}
                placeholder="MBBS, MD"
              />
              <Input
                label={t("settings.experience")}
                type="number" min={0} max={70}
                value={form.experience}
                onChange={(e) => set("experience", e.target.value)}
              />
              <Input
                label={t("settings.consultationFee")}
                type="number" min={0} step="0.01"
                value={form.consultationFee}
                onChange={(e) => set("consultationFee", e.target.value)}
              />
            </div>

            <div className="mx-5 mb-4 flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/40 px-4 py-3">
              <div className="h-9 w-9 rounded-lg bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-600/15 flex items-center justify-center shrink-0">
                <Video size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-text">{t("settings.videoConsults")}</div>
                <div className="text-[11px] text-text-muted">{t("settings.videoConsultsHelp")}</div>
              </div>
              <Toggle
                checked={form.telemedicineEnabled}
                onChange={(v) => set("telemedicineEnabled", v)}
                label={t("settings.videoConsults")}
              />
            </div>

            <div className="px-5 pb-5 flex justify-end">
              <Button
                leftIcon={<Save size={14} />}
                disabled={!dirty || !form.name.trim() || !form.specialization.trim()}
                loading={saveProfile.isPending}
                onClick={() => form && saveProfile.mutate(form)}
              >
                {t("settings.saveProfile")}
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* ─── Password ─── */}
      <Card padding={false} className="rounded-2xl overflow-hidden">
        <div className="px-5 pt-4">
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><KeyRound size={14} /> {t("settings.changePassword")}</span>} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-5">
          <Input
            label={t("settings.currentPassword")}
            type={showPwd ? "text" : "password"}
            autoComplete="current-password"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
          />
          <Input
            label={t("settings.newPassword")}
            type={showPwd ? "text" : "password"}
            autoComplete="new-password"
            hint={t("settings.passwordHint")}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
          />
          <Input
            label={t("settings.confirmNew")}
            type={showPwd ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
          />
        </div>
        {pwdErr && (
          <div className="mx-5 -mt-1 mb-2 text-[11px] font-semibold text-red-600">{pwdErr}</div>
        )}
        <div className="px-5 pb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="text-[11px] font-semibold text-text-muted hover:text-text flex items-center gap-1.5 transition-colors"
          >
            {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
            {showPwd ? t("settings.hidePasswords") : t("settings.showPasswords")}
          </button>
          <Button
            leftIcon={<Save size={14} />}
            disabled={!oldPwd || !newPwd || !confirmPwd}
            loading={changePwd.isPending}
            onClick={submitPassword}
          >
            {t("settings.updatePassword")}
          </Button>
        </div>
      </Card>

      <NotificationPrefsCard />

      {/* ─── Signing key ─── */}
      <Card padding={false} className="rounded-2xl overflow-hidden">
        <div className="px-5 pt-4">
          <CardHeader
            title={<span className="inline-flex items-center gap-1.5"><RotateCw size={14} /> {t("settings.signingKey")}</span>}
            subtitle={t("settings.signingKeyHelp")}
          />
        </div>
        <div className="p-5 flex items-center gap-3">
          <Button variant="secondary" leftIcon={<RotateCw size={14} />} onClick={() => setRotateOpen(true)}>
            {t("settings.rotate")}
          </Button>
        </div>
      </Card>

      <Modal
        open={rotateOpen}
        onClose={() => { setRotateOpen(false); setRotateResult(null); }}
        title={t("settings.signingKey")}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => { setRotateOpen(false); setRotateResult(null); }}>
              {t("common.cancel")}
            </Button>
            {!rotateResult ? (
              <Button leftIcon={<RotateCw size={14} />} loading={rotateKey.isPending} onClick={confirmRotate}>
                {t("settings.rotate")}
              </Button>
            ) : (
              <Button leftIcon={<CheckCircle2 size={14} />} onClick={() => { setRotateOpen(false); setRotateResult(null); }}>
                {t("common.close")}
              </Button>
            )}
          </div>
        }
      >
        {rotateResult ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-success text-sm font-medium">
              <CheckCircle2 size={16} />
              {t("settings.keyRotated")}
            </div>
            <div className="text-xs text-text-soft">
              <div><span className="text-text-muted">{t("settings.keyId")}: </span><span className="font-mono">{rotateResult.keyId}</span></div>
              <div><span className="text-text-muted">{t("settings.createdAt")}: </span>{formatDateTime(rotateResult.createdAt)}</div>
              <div className="mt-2">{rotateResult.note}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-soft">{t("settings.rotateExplain")}</p>
            <p className="text-xs text-text-muted">{t("settings.rotateAuditNote")}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function NotificationPrefsCard() {
  const t = useT();
  const qc = useQueryClient();
  const [prefDraft, setPrefDraft] = useState<Record<string, { inApp: boolean; push: boolean }> | null>(null);

  const { data: prefData, isLoading } = useQuery({
    queryKey: ["notification-preferences", "me"],
    queryFn: () =>
      api<{ preferences: Array<{ type: string; inApp: boolean; push: boolean }> }>(
        "/push/notification-preferences/me"
      ),
  });

  const updatePrefs = useMutation({
    mutationFn: (prefs: Array<{ type: string; inApp: boolean; push: boolean }>) =>
      api("/push/notification-preferences/me", { method: "PUT", json: { preferences: prefs } }),
    onSuccess: () => {
      setPrefDraft(null);
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success(t("settings.prefsSaved"));
    },
    onError: (err: unknown) =>
      toast.error(t("toast.error"), err instanceof Error ? err.message : undefined),
  });

  const serverPrefs = useMemo(() => {
    const out: Record<string, { inApp: boolean; push: boolean }> = {};
    for (const nt of NOTIF_TYPES) out[nt.key] = { inApp: true, push: true };
    for (const p of prefData?.preferences ?? []) {
      if (out[p.type]) out[p.type] = { inApp: !!p.inApp, push: !!p.push };
    }
    return out;
  }, [prefData]);

  const prefs = prefDraft ?? serverPrefs;
  const prefsDirty = !!prefDraft && JSON.stringify(prefDraft) !== JSON.stringify(serverPrefs);

  function setPref(type: string, field: "inApp" | "push", value: boolean) {
    setPrefDraft((cur) => ({ ...(cur ?? serverPrefs), [type]: { ...(cur ?? serverPrefs)[type], [field]: value } }));
  }

  function savePrefs() {
    updatePrefs.mutate(NOTIF_TYPES.map((nt) => ({
      type: nt.key,
      inApp: nt.emergency ? true : (prefs[nt.key]?.inApp ?? true),
      push: prefs[nt.key]?.push ?? true,
    })));
  }

  return (
    <Card padding={false} className="rounded-2xl overflow-hidden">
      <div className="px-5 pt-4">
        <CardHeader
          title={<span className="inline-flex items-center gap-1.5"><Bell size={14} /> {t("settings.notifTitle")}</span>}
          subtitle={t("settings.notifSubtitle")}
        />
      </div>
      {isLoading ? (
        <div className="p-5 flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-full" />)}
        </div>
      ) : (
        <>
          <div className="px-5 pt-3 pb-1 grid grid-cols-[1fr_auto_auto] items-center gap-3">
            <span />
            <span className="w-14 text-center text-[10px] font-extrabold uppercase tracking-wider text-text-muted">{t("settings.inApp")}</span>
            <span className="w-14 text-center text-[10px] font-extrabold uppercase tracking-wider text-text-muted">{t("settings.push")}</span>
          </div>
          <ul className="px-5 pb-4 flex flex-col divide-y divide-border/40">
            {NOTIF_TYPES.map((nt) => {
              const cur = prefs[nt.key] ?? { inApp: true, push: true };
              const Icon = nt.Icon;
              return (
                <li key={nt.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-surface-2 text-text-muted flex items-center justify-center shrink-0">
                      <Icon size={14} />
                    </div>
                    <span className="text-[13px] font-semibold text-text truncate">{t(nt.labelKey)}</span>
                    {nt.emergency && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/60 rounded-full px-1.5 py-0.5 shrink-0">
                        {t("settings.alwaysOn")}
                      </span>
                    )}
                  </div>
                  <div className="w-14 flex justify-center">
                    <Toggle checked={nt.emergency ? true : cur.inApp} disabled={nt.emergency} onChange={(v) => setPref(nt.key, "inApp", v)} label={`${t(nt.labelKey)} ${t("settings.inApp")}`} />
                  </div>
                  <div className="w-14 flex justify-center">
                    <Toggle checked={cur.push} onChange={(v) => setPref(nt.key, "push", v)} label={`${t(nt.labelKey)} ${t("settings.push")}`} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="px-5 pb-5 flex justify-end">
            <Button
              leftIcon={<Save size={14} />}
              disabled={!prefsDirty}
              loading={updatePrefs.isPending}
              onClick={savePrefs}
            >
              {t("settings.savePreferences")}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
