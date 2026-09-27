"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
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
import { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

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
  const patientRow = (patientQuery.data as any)?.patient?.patients;
  const bloodGroup = patientRow?.bloodGroup || "B+";

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

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<UserCheck size={13} aria-hidden />}
        kicker="Verified Patient Identity"
        title="My Health Profile & Account"
        description="Manage your clinical demographics, verified contact numbers, emergency identifiers, and account credentials."
        status={
          user?.verified ? (
            <HeroStatusPill label="Verified" tone="success" />
          ) : (
            <HeroStatusPill label="Active" tone="paper" />
          )
        }
        actions={
          <>
            <Link href="/patient/profile/edit" className={heroPrimaryAction}>
              <Edit2 size={13} aria-hidden />
              Edit Profile
            </Link>
            <button
              type="button"
              onClick={onLogout}
              disabled={signingOut}
              className={heroSecondaryAction}
            >
              {signingOut ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <LogOut size={13} aria-hidden />
              )}
              Sign Out
            </button>
          </>
        }
        footer={
          <>
            <span>EHR Identity · Primary Patient</span>
            <span>Verification · {user?.verified ? "Verified" : "Active"}</span>
            <span>Blood Group · Type {bloodGroup}</span>
            <span>Security Model · EHR Protected</span>
          </>
        }
      />

      {/* ── 2. Primary Patient Identification Card ─────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        {/* Identity Banner */}
        <div className="p-6 sm:p-7 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5 border-b border-border">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            {/* Avatar */}
            {user?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photo}
                alt=""
                width={72}
                height={72}
                className="h-18 w-18 rounded-lg object-cover shadow-md shrink-0"
              />
            ) : (
              <div className="grid h-18 w-18 place-items-center rounded-lg bg-ink text-brand-soft font-mono text-2xl font-bold shadow-md shrink-0" aria-hidden>
                {initials(user?.name) || "P"}
              </div>
            )}

            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                <h2 className="t-display text-xl sm:text-2xl text-text leading-tight">
                  {user?.name || "Patient"}
                </h2>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                    user?.verified
                      ? "bg-success-soft text-success"
                      : "bg-brand-soft text-brand",
                  )}
                >
                  {user?.verified ? "Verified Patient" : "Active Profile"}
                </span>
              </div>
              <p className="text-xs text-text-soft font-medium mt-1">
                {user?.email || "No email linked"} · {user?.phone || "No phone linked"}
              </p>
            </div>
          </div>

          <Link
            href="/patient/profile/edit"
            className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
          >
            <Edit2 size={13} aria-hidden />
            Update Demographics
          </Link>
        </div>

        {/* Detailed Demographics Data Grid */}
        <div className="p-6 sm:p-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-lg bg-surface-2 border border-border flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
              <Mail size={12} className="text-text-soft" aria-hidden />
              Email Address
            </span>
            <p className="text-xs sm:text-sm font-semibold text-text truncate">
              {user?.email || "—"}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
              <Phone size={12} className="text-text-soft" aria-hidden />
              Primary Phone
            </span>
            <p className="text-xs sm:text-sm font-semibold text-text truncate">
              {user?.phone || "—"}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
              <Heart size={12} className="text-danger" aria-hidden />
              Blood Group
            </span>
            <p className="text-xs sm:text-sm font-bold text-danger">
              Type {bloodGroup}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
              <User size={12} className="text-text-soft" aria-hidden />
              Portal Access Role
            </span>
            <p className="text-xs sm:text-sm font-semibold text-text capitalize">
              {user?.role || "patient"}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
              <CheckCircle2 size={12} className="text-success" aria-hidden />
              Account Status
            </span>
            <p className="text-xs sm:text-sm font-semibold text-success capitalize">
              {user?.status || "active"}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-2 border border-border flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Key size={12} className="text-text-soft" aria-hidden />
                Patient ID
              </span>
              {user?.id ? (
                <button
                  type="button"
                  onClick={() => handleCopyId(user.id)}
                  className="text-[10px] font-bold text-brand hover:underline cursor-pointer"
                >
                  {copiedId ? "Copied!" : "Copy"}
                </button>
              ) : null}
            </span>
            <p className="text-xs font-mono font-medium text-text-soft truncate select-all">
              {user?.id || "—"}
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Quick Access Clinical Cards ─────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/patient/emergency"
          className="p-4 rounded-xl bg-surface border border-border shadow-card hover:shadow-md hover:border-border-strong transition-all flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-danger-soft text-danger transition-transform group-hover:scale-105" aria-hidden>
              <HeartPulse size={18} />
            </div>
            <ChevronRight size={15} className="text-text-muted group-hover:text-danger group-hover:translate-x-0.5 transition-all" aria-hidden />
          </div>
          <div>
            <h3 className="font-bold text-text text-sm group-hover:text-danger transition-colors">
              Emergency Card
            </h3>
            <p className="text-[11px] text-text-soft mt-0.5">
              Life-saving ER trauma summary &amp; QR
            </p>
          </div>
        </Link>

        <Link
          href="/patient/health-id"
          className="p-4 rounded-xl bg-surface border border-border shadow-card hover:shadow-md hover:border-border-strong transition-all flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-brand-soft text-brand transition-transform group-hover:scale-105" aria-hidden>
              <QrCode size={18} />
            </div>
            <ChevronRight size={15} className="text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all" aria-hidden />
          </div>
          <div>
            <h3 className="font-bold text-text text-sm group-hover:text-brand transition-colors">
              Digital Health ID
            </h3>
            <p className="text-[11px] text-text-soft mt-0.5">
              25s rotating pass for clinic check-in
            </p>
          </div>
        </Link>

        <Link
          href="/patient/family"
          className="p-4 rounded-xl bg-surface border border-border shadow-card hover:shadow-md hover:border-border-strong transition-all flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-success-soft text-success transition-transform group-hover:scale-105" aria-hidden>
              <Users size={18} />
            </div>
            <ChevronRight size={15} className="text-text-muted group-hover:text-success group-hover:translate-x-0.5 transition-all" aria-hidden />
          </div>
          <div>
            <h3 className="font-bold text-text text-sm group-hover:text-success transition-colors">
              Family Locker
            </h3>
            <p className="text-[11px] text-text-soft mt-0.5">
              Dependents, parents, &amp; care locks
            </p>
          </div>
        </Link>

        <Link
          href="/patient/export"
          className="p-4 rounded-xl bg-surface border border-border shadow-card hover:shadow-md hover:border-border-strong transition-all flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-violet-50 text-violet-600 transition-transform group-hover:scale-105" aria-hidden>
              <Download size={18} />
            </div>
            <ChevronRight size={15} className="text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all" aria-hidden />
          </div>
          <div>
            <h3 className="font-bold text-text text-sm group-hover:text-brand transition-colors">
              Export Records
            </h3>
            <p className="text-[11px] text-text-soft mt-0.5">
              HL7 FHIR R4 &amp; JSON data archive
            </p>
          </div>
        </Link>
      </section>

      {/* ── 4. Account Security & Session Controls ──────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-surface-2 text-text-soft shrink-0" aria-hidden>
            <Lock size={20} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              Active Security Session
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              Signed in as <span className="font-semibold text-text">{user?.email || "patient"}</span>. Terminating this session invalidates local cache tokens.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          disabled={signingOut}
          className="pt-btn h-10 px-5 text-xs shrink-0 bg-danger-soft text-danger hover:bg-danger hover:text-white disabled:opacity-50"
        >
          {signingOut ? (
            <>
              <Loader2 size={13} className="animate-spin" aria-hidden />
              Signing out…
            </>
          ) : (
            <>
              <LogOut size={13} aria-hidden />
              Sign Out Everywhere
            </>
          )}
        </button>
      </section>
    </div>
  );
}
