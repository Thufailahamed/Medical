"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Edit2,
  Heart,
  HeartPulse,
  Key,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Phone,
  QrCode,
  User,
  UserCheck,
  Users,
} from "lucide-react";

import { usePatientProfile, useProfile } from "@/patient/hooks";
import { logout } from "@/portal/lib/auth";
import { loginHref } from "@/portal/lib/login";
import { cn } from "@/portal/lib/utils";
import {
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";

function initials(name: string | null | undefined) {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfilePage() {
  const query = useProfile();
  const patientQuery = usePatientProfile();
  const router = useRouter();

  const [signingOut, setSigningOut] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const user = query.data;
  const patientRow = patientQuery.data?.patient?.patients;
  const bloodGroup =
    (patientRow as { bloodGroup?: string } | undefined)?.bloodGroup || "B+";

  async function onLogout() {
    if (signingOut) return;
    if (!confirm("Are you sure you want to sign out of your patient account?")) return;
    setSigningOut(true);
    try {
      await logout();
      router.replace(loginHref({ port: "patient" }));
    } finally {
      setSigningOut(false);
    }
  }

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const demographics = [
    {
      icon: <Mail size={12} className="text-slate-400" aria-hidden />,
      label: "Email address",
      value: <span className="truncate">{user?.email || "—"}</span>,
    },
    {
      icon: <Phone size={12} className="text-slate-400" aria-hidden />,
      label: "Primary phone",
      value: <span className="truncate">{user?.phone || "—"}</span>,
    },
    {
      icon: <Heart size={12} className="text-rose-500" aria-hidden />,
      label: "Blood group",
      value: <span className="font-bold text-rose-600">Type {bloodGroup}</span>,
    },
    {
      icon: <User size={12} className="text-slate-400" aria-hidden />,
      label: "Portal access role",
      value: <span className="capitalize">{user?.role || "patient"}</span>,
    },
    {
      icon: <CheckCircle2 size={12} className="text-emerald-500" aria-hidden />,
      label: "Account status",
      value: (
        <span className="capitalize text-emerald-600">{user?.status || "active"}</span>
      ),
    },
  ];

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<UserCheck size={13} aria-hidden />}
        kicker="Profile"
        kickerMeta="Verified identity"
        title={
          <>
            My health <HeroAccent>Profile</HeroAccent>
          </>
        }
        description="Manage your clinical demographics, verified contact numbers, emergency identifiers, and account credentials."
        chips={
          <>
            {user?.verified ? (
              <span className={HERO_CHIP}>
                <CheckCircle2 size={12} className="text-emerald-300" />
                Verified patient
              </span>
            ) : (
              <span className={HERO_CHIP}>Active profile</span>
            )}
            <span className={HERO_CHIP}>
              <Heart size={12} className="text-rose-300" />
              Type {bloodGroup}
            </span>
          </>
        }
        actions={
          <>
            <Link href="/patient/profile/edit" className={HERO_PRIMARY}>
              <Edit2 size={13} className="text-sky-600" /> Edit profile
            </Link>
            <button
              type="button"
              onClick={onLogout}
              disabled={signingOut}
              className={HERO_GHOST}
            >
              {signingOut ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <LogOut size={13} aria-hidden />
              )}
              Log out
            </button>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<UserCheck size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Identity"
          value={user?.verified ? "Verified" : "Active"}
          sub="Primary patient"
        />
        <StatTile
          icon={<Heart size={16} />}
          tone="bg-rose-50 text-rose-600"
          label="Blood group"
          value={bloodGroup}
          sub="Emergency marker"
        />
        <StatTile
          icon={<HeartPulse size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Emergency card"
          value="ER"
          sub="Trauma summary + QR"
          href="/patient/emergency"
        />
        <StatTile
          icon={<QrCode size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Health ID"
          value="QR"
          sub="Clinic check-in pass"
          href="/patient/health-id"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {/* Identity card */}
          <section className={cn(PANEL, "overflow-hidden")}>
            <div className="flex flex-col items-center justify-between gap-5 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
                {user?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photo}
                    alt=""
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover shadow-md"
                  />
                ) : (
                  <div
                    className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-2xl bg-[#07233a] font-mono text-2xl font-bold text-sky-200 shadow-md"
                    aria-hidden
                  >
                    {initials(user?.name) || "P"}
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                    <h2 className="text-xl font-semibold leading-tight tracking-[-0.02em] text-slate-900 sm:text-2xl">
                      {user?.name || "Patient"}
                    </h2>
                    <span
                      className={cn(
                        "rounded-md px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        user?.verified
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-sky-50 text-sky-700",
                      )}
                    >
                      {user?.verified ? "Verified patient" : "Active profile"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {user?.email || "No email linked"} · {user?.phone || "No phone linked"}
                  </p>
                </div>
              </div>
              <Link
                href="/patient/profile/edit"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
              >
                <Edit2 size={13} aria-hidden /> Update demographics
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {demographics.map((d) => (
                <div
                  key={d.label}
                  className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                >
                  <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase text-slate-400">
                    {d.icon}
                    {d.label}
                  </span>
                  <p className="text-xs font-semibold text-slate-900 sm:text-sm">
                    {d.value}
                  </p>
                </div>
              ))}

              <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <span className="flex items-center justify-between text-[10.5px] font-bold uppercase text-slate-400">
                  <span className="flex items-center gap-1">
                    <Key size={12} className="text-slate-400" aria-hidden />
                    Patient ID
                  </span>
                  {user?.id ? (
                    <button
                      type="button"
                      onClick={() => handleCopyId(user.id)}
                      className="cursor-pointer text-[10px] font-bold text-sky-700 hover:underline"
                    >
                      {copiedId ? "Copied!" : "Copy"}
                    </button>
                  ) : null}
                </span>
                <p className="select-all truncate font-mono text-xs font-medium text-slate-500">
                  {user?.id || "—"}
                </p>
              </div>
            </div>
          </section>

          {/* Security session */}
          <section className={PANEL}>
            <PanelHeader
              icon={<Lock size={16} />}
              tone="bg-rose-50 text-rose-600"
              title="Active security session"
              caption={`Signed in as ${user?.email || "patient"}`}
            />
            <div className="mt-4 flex flex-col items-center justify-between gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row">
              <p className="text-xs leading-relaxed text-slate-500">
                Terminating this session invalidates local cache tokens on this device
                and any linked sessions.
              </p>
              <button
                type="button"
                onClick={onLogout}
                disabled={signingOut}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-rose-50 px-5 text-xs font-bold text-rose-600 transition hover:bg-rose-600 hover:text-white disabled:opacity-50"
              >
                {signingOut ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                    Signing out…
                  </>
                ) : (
                  <>
                    <LogOut size={13} aria-hidden />
                    Sign out everywhere
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="profile-tools"
            title="Quick access"
            tag="Clinical"
            tools={[
              {
                icon: HeartPulse,
                label: "Emergency card",
                hint: "ER summary",
                href: "/patient/emergency",
                tone: "from-rose-500 to-red-600 shadow-rose-500/30",
              },
              {
                icon: QrCode,
                label: "Health ID",
                hint: "25s QR pass",
                href: "/patient/health-id",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: Users,
                label: "Family locker",
                hint: "Dependents",
                href: "/patient/family",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: Download,
                label: "Export records",
                hint: "FHIR / JSON",
                href: "/patient/export",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
              {
                icon: Edit2,
                label: "Edit profile",
                hint: "Demographics",
                href: "/patient/profile/edit",
                tone: "from-amber-500 to-orange-600 shadow-amber-500/30",
              },
              {
                icon: Lock,
                label: "Consents",
                hint: "Grants",
                href: "/patient/consents",
                tone: "from-slate-500 to-slate-700 shadow-slate-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}
