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
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

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
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<Users size={13} />}
        kicker="Care Team Registry"
        title="Add Care Team Member"
        description="Expand your clinical circle. Connect primary physicians, accredited specialists, pharmacists, nurses, or caregivers to your personal health record."
        actions={
          <>
            <Link href="/patient/care-team" className={heroSecondaryAction}>
              <ChevronLeft size={13} />
              <span>Back to Care Team</span>
            </Link>
            <Link href="/patient/care-team" className={heroPrimaryAction}>
              <UserCheck size={14} />
              <span>View My Team</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>5 role categories</span>
            <span>Privacy guard · HIPAA secure</span>
            <span>Connection · EHR synced</span>
            <span>Care network · multidisciplinary</span>
          </>
        }
      />

      {/* ── 2. Add Care Team Member Form Card ──────────────────────────────── */}
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <section className="rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-card flex flex-col gap-6">
          <div className="border-b border-border pb-4">
            <h2 className="t-card-title text-text flex items-center gap-2">
              <UserPlus size={19} className="text-brand" aria-hidden />
              <span>Clinician &amp; Caregiver Profile</span>
            </h2>
            <p className="text-xs text-text-soft mt-0.5">
              Specify your provider&apos;s credentials, role, practice address, and direct clinical coordinates.
            </p>
          </div>

          {/* Clinician Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
              Practitioner Full Name *
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Dr. Anjali Perera, MD"
                className="pt-input pl-10 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Interactive Role Selection Grid */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
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
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer group shadow-2xs hover:-translate-y-0.5",
                      isSelected
                        ? "bg-ink text-white border-ink shadow-md"
                        : "bg-surface border-border hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-md text-sm",
                          isSelected
                            ? "bg-white/15 text-white"
                            : "bg-brand-soft text-brand",
                        )}
                        aria-hidden
                      >
                        <Icon size={16} />
                      </div>

                      {isSelected && (
                        <div className="grid h-5 w-5 place-items-center rounded-full bg-white text-ink" aria-hidden>
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
                          isSelected ? "text-white/85" : "text-text-muted",
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
              <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                Clinical Specialty (Optional)
              </label>
              <div className="relative">
                <Stethoscope
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Cardiology, Endocrinology, Pediatrics"
                  className="pt-input pl-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                Hospital / Organization (Optional)
              </label>
              <div className="relative">
                <Building2
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Asiri Central Hospital, Lanka Hospitals"
                  className="pt-input pl-10 text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Contact Coordinates (Phone & Email) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                Direct Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+94 77 123 4567"
                  className="pt-input pl-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                Official Clinical Email (Optional)
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@hospital.org"
                  className="pt-input pl-10 text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Clinical Scope & Context Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
              Care Scope &amp; Special Instructions (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Managing hypertension therapy, post-op cardiac follow-up, weekly wound dressing…"
              className="pt-input h-auto py-3 text-xs sm:text-sm leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* ── 3. Action Buttons ────────────────────────────────────────────── */}
        <footer className="flex items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-border shadow-card">
          <Link
            href="/patient/care-team"
            className="pt-btn pt-btn-secondary h-10 px-4 text-xs"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={add.isPending}
            className="pt-btn pt-btn-primary h-10 px-6 text-xs disabled:opacity-50"
          >
            {add.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Saving to Care Team…
              </>
            ) : (
              <>
                <UserPlus size={14} aria-hidden />
                Add Member to Care Team
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}
