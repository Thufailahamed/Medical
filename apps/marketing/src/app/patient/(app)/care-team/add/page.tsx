"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronLeft,
  HeartPulse,
  Loader2,
  Mail,
  Phone,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

import { useAddCareTeamMember } from "@/patient/hooks/care-team";
import { cn } from "@/portal/lib/utils";

const ROLES = [
  {
    value: "primary_doctor",
    label: "Primary Doctor",
    desc: "Main physician & GP",
    icon: Stethoscope,
  },
  {
    value: "specialist",
    label: "Specialist",
    desc: "Cardiologist, Surgeon, etc.",
    icon: Sparkles,
  },
  {
    value: "pharmacist",
    label: "Pharmacist",
    desc: "Prescription dispenser",
    icon: Pill,
  },
  {
    value: "nurse",
    label: "Nurse",
    desc: "Clinical caregiver",
    icon: HeartPulse,
  },
  {
    value: "other",
    label: "Other Clinician",
    desc: "Therapist, Dietitian, etc.",
    icon: Users,
  },
] as const;

export default function AddCareTeamPage() {
  const router = useRouter();
  const add = useAddCareTeamMember();

  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("primary_doctor");
  const [specialty, setSpecialty] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Please enter the clinician or caregiver name.");
      return;
    }

    setError(null);
    try {
      await add.mutateAsync({
        name: name.trim(),
        role,
        specialty: specialty.trim() || undefined,
        organization: organization.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      router.push("/patient/care-team");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add care team member.");
    }
  }

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
                <Users size={12} className="text-sky-300" />
                Care Team Registry
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Add Care Team Member
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Expand your clinical circle. Connect primary physicians, accredited specialists, pharmacists, nurses, or caregivers to your personal health record.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/patient/care-team"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <ChevronLeft size={13} />
                <span>Back to Care Team</span>
              </Link>
              <Link
                href="/patient/care-team"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <UserCheck size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>View My Team</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Stethoscope size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Role Types
                </p>
                <p className="text-base font-extrabold text-white">5 Categories</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Privacy Guard
                </p>
                <p className="text-base font-extrabold text-white">HIPAA Secure</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Connection
                </p>
                <p className="text-base font-extrabold text-white">EHR Synced</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <HeartPulse size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Care Network
                </p>
                <p className="text-base font-extrabold text-white">Multidisciplinary</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Add Care Team Member Form Card ──────────────────────────────── */}
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs flex flex-col gap-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus size={19} className="text-sky-600" />
              <span>Clinician &amp; Caregiver Profile</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify your provider&apos;s credentials, role, practice address, and direct clinical coordinates.
            </p>
          </div>

          {/* Clinician Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Practitioner Full Name *
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Dr. Anjali Perera, MD"
                className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
          </div>

          {/* Interactive Role Selection Grid */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Clinical Role &amp; Responsibilities *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              {ROLES.map((r) => {
                const isSelected = role === r.value;
                const Icon = r.icon;

                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    style={{
                      backgroundColor: isSelected ? "#0284c7" : "#ffffff",
                      borderColor: isSelected ? "#0284c7" : "#e2e8f0",
                      color: isSelected ? "#ffffff" : "#1e293b",
                    }}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer group shadow-2xs hover:scale-[1.02]",
                      isSelected
                        ? "shadow-md ring-2 ring-sky-500/30"
                        : "hover:border-sky-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-xl flex items-center justify-center text-sm",
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-sky-50 text-sky-700",
                        )}
                      >
                        <Icon size={16} />
                      </div>

                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-white text-sky-700 flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-xs sm:text-sm leading-tight">
                        {r.label}
                      </h4>
                      <p
                        className={cn(
                          "text-[10.5px] mt-0.5 line-clamp-1",
                          isSelected ? "text-white/85" : "text-slate-400",
                        )}
                      >
                        {r.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specialty & Hospital / Organization Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Clinical Specialty (Optional)
              </label>
              <div className="relative">
                <Stethoscope
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Cardiology, Endocrinology, Pediatrics"
                  className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Hospital / Organization (Optional)
              </label>
              <div className="relative">
                <Building2
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Asiri Central Hospital, Lanka Hospitals"
                  className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Contact Coordinates (Phone & Email) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Direct Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+94 77 123 4567"
                  className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Official Clinical Email (Optional)
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@hospital.org"
                  className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Clinical Scope & Context Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Care Scope &amp; Special Instructions (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Managing hypertension therapy, post-op cardiac follow-up, weekly wound dressing…"
              className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* ── 3. Action Buttons ────────────────────────────────────────────── */}
        <footer className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <Link
            href="/patient/care-team"
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={add.isPending}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            {add.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving to Care Team…</span>
              </>
            ) : (
              <>
                <UserPlus size={14} />
                <span>Add Member to Care Team</span>
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}
