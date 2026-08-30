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
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from "lucide-react";

import { usePatientProfile, useProfile } from "@/patient/hooks";
import { logout } from "@/portal/lib/auth";
import { loginHref } from "@/portal/lib/login";
import { cn } from "@/portal/lib/utils";

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
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <UserCheck size={12} className="text-sky-300" />
                Verified Patient Identity
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                My Health Profile &amp; Account
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Manage your clinical demographics, verified contact numbers, emergency identifiers, and account credentials.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/patient/profile/edit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <Edit2 size={13} className="text-sky-700" />
                <span>Edit Profile</span>
              </Link>
              <button
                type="button"
                onClick={onLogout}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-100 bg-rose-900/30 hover:bg-rose-900/50 border border-rose-400/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {signingOut ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <LogOut size={13} />
                )}
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <User size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  EHR Identity
                </p>
                <p className="text-base font-extrabold text-white">
                  Primary Patient
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Verification
                </p>
                <p className="text-base font-extrabold text-white">
                  {user?.verified ? "Verified" : "Active"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-rose-500/30 flex items-center justify-center text-rose-200 shrink-0 font-bold text-xs">
                {bloodGroup}
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Blood Group
                </p>
                <p className="text-base font-extrabold text-white">
                  Type {bloodGroup}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Lock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Security Model
                </p>
                <p className="text-base font-extrabold text-white">EHR Protected</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Primary Patient Identification Card ─────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {/* Identity Banner */}
        <div className="p-6 sm:p-7 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            {/* Avatar */}
            {user?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photo}
                alt=""
                width={72}
                height={72}
                className="h-18 w-18 rounded-2xl object-cover ring-4 ring-sky-50 shadow-md shrink-0"
              />
            ) : (
              <div className="h-18 w-18 rounded-2xl bg-gradient-to-br from-sky-600 via-sky-700 to-cyan-800 text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0">
                {initials(user?.name) || "P"}
              </div>
            )}

            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                  {user?.name || "Patient"}
                </h2>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border",
                    user?.verified
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-sky-50 text-sky-700 border-sky-200",
                  )}
                >
                  {user?.verified ? "Verified Patient" : "Active Profile"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {user?.email || "No email linked"} · {user?.phone || "No phone linked"}
              </p>
            </div>
          </div>

          <Link
            href="/patient/profile/edit"
            className="px-4 py-2 rounded-xl text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Edit2 size={13} className="text-sky-700" />
            <span>Update Demographics</span>
          </Link>
        </div>

        {/* Detailed Demographics Data Grid */}
        <div className="p-6 sm:p-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Mail size={12} className="text-slate-500" />
              Email Address
            </span>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
              {user?.email || "—"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Phone size={12} className="text-slate-500" />
              Primary Phone
            </span>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
              {user?.phone || "—"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Heart size={12} className="text-rose-600" />
              Blood Group
            </span>
            <p className="text-xs sm:text-sm font-bold text-rose-700">
              Type {bloodGroup}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <User size={12} className="text-slate-500" />
              Portal Access Role
            </span>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 capitalize">
              {user?.role || "patient"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600" />
              Account Status
            </span>
            <p className="text-xs sm:text-sm font-semibold text-emerald-700 capitalize">
              {user?.status || "active"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Key size={12} className="text-slate-500" />
                Patient ID
              </span>
              {user?.id ? (
                <button
                  type="button"
                  onClick={() => handleCopyId(user.id)}
                  className="text-[10px] font-bold text-sky-700 hover:underline cursor-pointer"
                >
                  {copiedId ? "Copied!" : "Copy"}
                </button>
              ) : null}
            </span>
            <p className="text-xs font-mono font-medium text-slate-700 truncate select-all">
              {user?.id || "—"}
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Quick Access Clinical Cards ─────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/patient/emergency"
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-rose-300 transition-all flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100 group-hover:scale-105 transition-transform">
              <HeartPulse size={18} />
            </div>
            <ChevronRight size={15} className="text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-rose-700 transition-colors">
              Emergency Card
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Life-saving ER trauma summary &amp; QR
            </p>
          </div>
        </Link>

        <Link
          href="/patient/health-id"
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100 group-hover:scale-105 transition-transform">
              <QrCode size={18} />
            </div>
            <ChevronRight size={15} className="text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-sky-700 transition-colors">
              Digital Health ID
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              25s rotating pass for clinic check-in
            </p>
          </div>
        </Link>

        <Link
          href="/patient/family"
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
              <Users size={18} />
            </div>
            <ChevronRight size={15} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
              Family Locker
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dependents, parents, &amp; care locks
            </p>
          </div>
        </Link>

        <Link
          href="/patient/export"
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100 group-hover:scale-105 transition-transform">
              <Download size={18} />
            </div>
            <ChevronRight size={15} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-purple-700 transition-colors">
              Export Records
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              HL7 FHIR R4 &amp; JSON data archive
            </p>
          </div>
        </Link>
      </section>

      {/* ── 4. Account Security & Session Controls ──────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Lock size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Active Security Session
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Signed in as <span className="font-semibold text-slate-800">{user?.email || "patient"}</span>. Terminating this session invalidates local cache tokens.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          disabled={signingOut}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shrink-0 flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {signingOut ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Signing out…</span>
            </>
          ) : (
            <>
              <LogOut size={13} />
              <span>Sign Out Everywhere</span>
            </>
          )}
        </button>
      </section>
    </div>
  );
}
