"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { LocaleSwitcher } from "@/hospital/components/shell/LocaleSwitcher";
import { useAuthStore, hasHospitalRole, isHospitalAdmin, isPharmacy, isLab } from "@/hospital/stores/auth";
import { logout } from "@/hospital/lib/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import {
  Building2,
  CheckCircle2,
  Globe,
  Languages,
  LogOut,
  Shield,
  Sparkles,
  User,
} from "lucide-react";

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const locale = useAuthStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const activeTenant = useAuthStore((s) => s.activeTenant);

  async function onLogout() {
    await logout();
    router.replace("/hospital/login");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader
            title={t("settings.profile")}
            icon={<User size={15} className="text-brand" />}
          />
          <dl className="mt-4 space-y-3 text-sm">
            <Row label={t("common.name")} value={user?.name ?? "—"} />
            <Row label={t("common.email")} value={user?.email ?? "—"} />
            <Row label={t("common.phone")} value={user?.phone ?? "—"} />
            <div className="flex items-center justify-between">
              <dt className="text-text-muted">{t("settings.role")}</dt>
              <dd>
                <Pill tone={isHospitalAdmin(user) ? "accent" : "neutral"}>
                  {user?.role ?? "—"}
                </Pill>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-muted">{t("settings.status")}</dt>
              <dd>
                <Pill tone={user?.status === "active" ? "success" : "warn"}>
                  {user?.status ?? "—"}
                </Pill>
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-text-muted">
            {t("settings.profileHint")}
          </p>
        </Card>

        <Card>
          <CardHeader
            title={t("settings.facility")}
            icon={<Building2 size={15} className="text-brand" />}
          />
          <dl className="mt-4 space-y-3 text-sm">
            <Row
              label={t("settings.facilityName")}
              value={activeTenant?.id ?? "—"}
            />
            <div className="flex items-center justify-between">
              <dt className="text-text-muted">{t("settings.facilityType")}</dt>
              <dd>
                <Pill tone="info">{activeTenant?.type ?? "—"}</Pill>
              </dd>
            </div>
            <Row
              label={t("settings.facilityId")}
              value={activeTenant?.id ?? "—"}
            />
          </dl>
          <p className="mt-4 text-xs text-text-muted">
            {t("settings.facilityHint")}
          </p>
        </Card>

        <Card>
          <CardHeader
            title={t("settings.language")}
            icon={<Languages size={15} className="text-brand" />}
          />
          <p className="mt-2 text-sm text-text-muted">
            {t("settings.languageHint")}
          </p>
          <div className="mt-4">
            <LocaleSwitcher />
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t("settings.capabilities")}
            icon={<Shield size={15} className="text-brand" />}
          />
          <ul className="mt-4 space-y-2 text-sm">
            <Cap on={hasHospitalRole(user, "hospital_admin")}>
              {t("settings.capAdmin")}
            </Cap>
            <Cap on={hasHospitalRole(user, "hospital_staff")}>
              {t("settings.capStaff")}
            </Cap>
            <Cap on={isPharmacy(user)}>{t("settings.capPharmacy")}</Cap>
            <Cap on={isLab(user)}>{t("settings.capLab")}</Cap>
          </ul>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader
            title={
              <span className="text-red-700">{t("settings.session")}</span>
            }
            icon={<LogOut size={15} className="text-red-600" />}
          />
          <p className="mt-2 text-sm text-text-muted">
            {t("settings.sessionHint")}
          </p>
          <div className="mt-4">
            <Button variant="danger" onClick={onLogout}>
              {t("shell.logout")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium text-text">{value}</dd>
    </div>
  );
}

function Cap({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {on ? (
        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
      ) : (
        <Sparkles size={14} className="text-zinc-300 shrink-0" />
      )}
      <span className={on ? "text-text" : "text-text-muted line-through"}>
        {children}
      </span>
    </li>
  );
}