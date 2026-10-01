"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Globe,
  Languages,
  LogOut,
  Mail,
  Phone,
  Server,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  User,
  UserCog,
} from "lucide-react";
import { LocaleSwitcher } from "@/hospital/components/shell/LocaleSwitcher";
import { useAuthStore, hasHospitalRole, isHospitalAdmin, isPharmacy, isLab } from "@/hospital/stores/auth";
import { logout } from "@/hospital/lib/auth";
import { loginHref } from "@/portal/lib/login";
import { useT } from "@/hospital/i18n";
import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroTile,
  InfoField,
  QuickToolsPanel,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const locale = useAuthStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const activeTenant = useAuthStore((s) => s.activeTenant);

  async function onLogout() {
    await logout();
    router.replace(loginHref({ port: "facility" }));
  }

  const initials = (user?.name ?? user?.email ?? "?")
    .split(/[\s@]+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const capCount = [
    hasHospitalRole(user, "hospital_admin"),
    hasHospitalRole(user, "hospital_staff"),
    isPharmacy(user),
    isLab(user),
  ].filter(Boolean).length;

  const hero = (
    <DoctorHero
      kickerIcon={<SettingsIcon size={13} aria-hidden />}
      kicker={t("nav.admin")}
      kickerMeta={t("settings.title")}
      title={
        <>
          {t("settings.title")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · {user?.name ?? "account"}
          </span>
        </>
      }
      description={t("settings.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Shield size={12} className="text-violet-300" />
            {user?.role?.replace(/_/g, " ") ?? "—"}
          </span>
          <span className={HERO_CHIP}>
            <Globe size={12} className="text-sky-300" />
            {locale.toUpperCase()}
          </span>
          <span className={HERO_CHIP}>
            <Building2 size={12} className="text-emerald-300" />
            {activeTenant?.type ?? "—"}
          </span>
        </>
      }
      aside={<HeroTile>{initials}</HeroTile>}
      actions={
        <>
          <Link href="/hospital/settings/pacs" className={HERO_GHOST}>
            <Server size={14} />
            {t("nav.pacsIntegrations")}
          </Link>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:bg-rose-500"
          >
            <LogOut size={14} />
            {t("shell.logout")}
          </button>
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Shield size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("settings.role")}
          value={user?.role?.replace(/_/g, " ") ?? "—"}
          sub={t("settings.profile")}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("settings.status")}
          value={user?.status ?? "—"}
          sub={t("settings.profile")}
        />
        <StatTile
          icon={<Building2 size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("settings.facilityType")}
          value={activeTenant?.type ?? "—"}
          sub={t("settings.facility")}
        />
        <StatTile
          icon={<Sparkles size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("settings.capabilities")}
          value={String(capCount)}
          sub="Scopes granted"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <div className="grid gap-5 md:grid-cols-2">
            <section className={PANEL}>
              <PanelHeader
                icon={<User size={16} />}
                tone="bg-sky-50 text-sky-600"
                title={t("settings.profile")}
              />
              <div className="mt-4 flex flex-col gap-2.5">
                <InfoField icon={<User size={14} />} label={t("common.name")}>{user?.name ?? "—"}</InfoField>
                <InfoField icon={<Mail size={14} />} label={t("common.email")}>{user?.email ?? "—"}</InfoField>
                <InfoField icon={<Phone size={14} />} label={t("common.phone")}>{user?.phone ?? "—"}</InfoField>
                <InfoField icon={<Shield size={14} />} label={t("settings.role")}>
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", isHospitalAdmin(user) ? TONE_BADGE.violet : TONE_BADGE.slate)}>
                    {user?.role?.replace(/_/g, " ") ?? "—"}
                  </span>
                </InfoField>
              </div>
              <p className="mt-4 text-xs text-slate-500">{t("settings.profileHint")}</p>
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<Building2 size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title={t("settings.facility")}
              />
              <div className="mt-4 flex flex-col gap-2.5">
                <InfoField icon={<Building2 size={14} />} label={t("settings.facilityName")}>
                  {activeTenant?.id ?? "—"}
                </InfoField>
                <InfoField icon={<Sparkles size={14} />} label={t("settings.facilityType")}>
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", TONE_BADGE.sky)}>
                    {activeTenant?.type ?? "—"}
                  </span>
                </InfoField>
                <InfoField icon={<Building2 size={14} />} label={t("settings.facilityId")} mono>
                  {activeTenant?.id ?? "—"}
                </InfoField>
              </div>
              <p className="mt-4 text-xs text-slate-500">{t("settings.facilityHint")}</p>
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<Languages size={16} />}
                tone="bg-violet-50 text-violet-600"
                title={t("settings.language")}
              />
              <p className="mt-3 text-sm text-slate-500">{t("settings.languageHint")}</p>
              <div className="mt-4">
                <LocaleSwitcher />
              </div>
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<Shield size={16} />}
                tone="bg-amber-50 text-amber-600"
                title={t("settings.capabilities")}
                caption={`${capCount}/4`}
              />
              <ul className="mt-4 space-y-2.5 text-sm">
                <Cap on={hasHospitalRole(user, "hospital_admin")}>{t("settings.capAdmin")}</Cap>
                <Cap on={hasHospitalRole(user, "hospital_staff")}>{t("settings.capStaff")}</Cap>
                <Cap on={isPharmacy(user)}>{t("settings.capPharmacy")}</Cap>
                <Cap on={isLab(user)}>{t("settings.capLab")}</Cap>
              </ul>
            </section>
          </div>

          <section className={cn(PANEL, "border-rose-200/60")}>
            <PanelHeader
              icon={<LogOut size={16} />}
              tone="bg-rose-50 text-rose-600"
              title={t("settings.session")}
            />
            <p className="mt-3 text-sm text-slate-500">{t("settings.sessionHint")}</p>
            <button
              onClick={onLogout}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
            >
              <LogOut size={14} />
              {t("shell.logout")}
            </button>
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="settings-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: Server, label: t("nav.pacsIntegrations"), hint: "Imaging", href: "/hospital/settings/pacs", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: UserCog, label: t("nav.staff"), hint: "Directory", href: "/hospital/staff", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
              { icon: Mail, label: t("nav.staffInvites"), hint: t("staff.inviteStaff"), href: "/hospital/staff/invites", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}

function Cap({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-[color:var(--ink-border)] px-3.5 py-2.5">
      {on ? (
        <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
      ) : (
        <Sparkles size={15} className="shrink-0 text-slate-300" />
      )}
      <span className={on ? "font-medium text-slate-800" : "text-slate-400 line-through"}>
        {children}
      </span>
    </li>
  );
}
