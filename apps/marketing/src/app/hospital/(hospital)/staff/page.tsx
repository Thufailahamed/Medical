"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Mail,
  RefreshCw,
  Shield,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useT } from "@/hospital/i18n";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  PanelSkeleton,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

interface StaffMember {
  id: string;
  name?: string;
  fullName?: string;
  email?: string;
  role?: string;
  department?: string;
  active?: boolean;
}

const ROLE_TONE: Record<string, string> = {
  hospital_admin: TONE_BADGE.violet,
  super_admin: TONE_BADGE.violet,
  doctor: TONE_BADGE.sky,
  hospital_staff: TONE_BADGE.emerald,
  pharmacy: TONE_BADGE.amber,
  laboratory: TONE_BADGE.rose,
};

export default function StaffPage() {
  const t = useT();
  const [search, setSearch] = useState("");

  const list = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<{ staff: StaffMember[] }>("/hospital-portal/staff"),
  });

  const staff = list.data?.staff ?? [];
  const activeCount = staff.filter((s) => s.active).length;
  const roles = new Set(staff.map((s) => s.role).filter(Boolean)).size;
  const departments = new Set(staff.map((s) => s.department).filter(Boolean)).size;

  const filtered = staff.filter(
    (s) =>
      !search ||
      (s.name ?? s.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.role?.toLowerCase().includes(search.toLowerCase()) ||
      s.department?.toLowerCase().includes(search.toLowerCase())
  );

  const hero = (
    <DoctorHero
      kickerIcon={<UserCog size={13} aria-hidden />}
      kicker={t("nav.admin")}
      kickerMeta={t("nav.staff")}
      title={
        <>
          {t("nav.staff")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · directory
          </span>
        </>
      }
      description={`${activeCount} ${t("settings.status").toLowerCase()} · ${roles} ${t("staff.role").toLowerCase()}s`}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Users size={12} className="text-emerald-300" />
            {staff.length} {t("nav.staff").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <CheckCircle2 size={12} className="text-sky-300" />
            {activeCount} {t("settings.status").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<Users size={18} />}
          label={t("nav.staff")}
          value={list.isLoading ? "…" : staff.length}
          sub={`${activeCount} active · ${departments} ${t("nav.departments").toLowerCase()}`}
        />
      }
      actions={
        <>
          <button type="button" onClick={() => list.refetch()} className={HERO_GHOST}>
            <RefreshCw size={13} className={list.isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/staff/departments" className={HERO_GHOST}>
            <Building2 size={14} />
            {t("nav.departments")}
          </Link>
          <Link href="/hospital/staff/invites" className={HERO_GHOST}>
            <Mail size={14} />
            {t("nav.staffInvites")}
          </Link>
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Users size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("nav.staff")}
          value={list.isLoading ? "…" : String(staff.length)}
          sub={t("staff.empty")}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("settings.status")}
          value={list.isLoading ? "…" : String(activeCount)}
          sub="Active accounts"
        />
        <StatTile
          icon={<Shield size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("staff.role")}
          value={list.isLoading ? "…" : String(roles)}
          sub="Distinct roles"
        />
        <StatTile
          icon={<Building2 size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("nav.departments")}
          value={list.isLoading ? "…" : String(departments)}
          sub={t("nav.departments")}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("nav.staff")}
            caption={list.isLoading ? t("common.loading") : `${filtered.length}`}
          />
          <div className="mt-4">
            <PanelSearch value={search} onChange={setSearch} placeholder={t("common.search")} />
          </div>
          {list.isLoading ? (
            <PanelSkeleton rows={5} className="mt-4" />
          ) : !filtered.length ? (
            <EmptyBlock
              icon={<Users size={19} />}
              title={t("staff.empty")}
              body="Staff members will appear here once invited."
              actions={
                <Link
                  href="/hospital/staff/invites"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Mail size={13} /> {t("staff.inviteStaff")}
                </Link>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {filtered.map((s) => (
                <li key={s.id}>
                  <RailRow
                    tone={s.active ? "sky" : "slate"}
                    active={s.active}
                    icon={<UserCog size={16} />}
                    title={s.name ?? s.fullName ?? "—"}
                    meta={`${s.email ?? "—"}${s.department ? ` · ${s.department}` : ""}`}
                    trailing={
                      <>
                        <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", ROLE_TONE[s.role ?? ""] ?? TONE_BADGE.slate)}>
                          {s.role?.replace(/_/g, " ")}
                        </span>
                        {s.active ? (
                          <CheckCircle2 size={15} className="text-emerald-500" aria-label={t("common.yes")} />
                        ) : (
                          <XCircle size={15} className="text-slate-300" aria-label={t("common.no")} />
                        )}
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="staff-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: Mail, label: t("nav.staffInvites"), hint: t("staff.inviteStaff"), href: "/hospital/staff/invites", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Building2, label: t("nav.departments"), hint: "Structure", href: "/hospital/staff/departments", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { icon: Shield, label: t("nav.settings"), hint: t("settings.title"), href: "/hospital/settings", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
