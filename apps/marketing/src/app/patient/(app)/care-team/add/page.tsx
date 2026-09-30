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
  UserPlus,
  Users,
} from "lucide-react";

import { useAddCareTeamMember } from "@/patient/hooks/care-team";
import { cn } from "@/portal/lib/utils";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

const ROLES = [
  { value: "primary_doctor", label: "Primary doctor", desc: "Your GP", icon: Stethoscope, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
  { value: "specialist", label: "Specialist", desc: "Cardiology, surgery…", icon: Sparkles, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
  { value: "pharmacist", label: "Pharmacist", desc: "Dispenses medicines", icon: Pill, tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
  { value: "nurse", label: "Nurse", desc: "Clinical caregiver", icon: HeartPulse, tone: "from-rose-500 to-pink-600 shadow-rose-500/30" },
  { value: "other", label: "Other", desc: "Therapist, dietitian…", icon: Users, tone: "from-slate-600 to-slate-800 shadow-slate-500/30" },
] as const;

function IconInput({
  id,
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; icon: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-slate-400" aria-hidden>
        {icon}
      </span>
      <input id={id} {...props} className={cn(FIELD_INPUT, "pl-9")} />
    </div>
  );
}

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

  const selectedRole = ROLES.find((r) => r.value === role) ?? ROLES[0];
  const RoleIcon = selectedRole.icon;

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        kickerIcon={<UserPlus size={13} aria-hidden />}
        kicker="Care team"
        kickerMeta="Add clinician"
        title={
          <>
            Add to your <HeroAccent>care team</HeroAccent>
          </>
        }
        description="Add doctors, specialists, pharmacists or caregivers who look after you, so your contacts are in one place."
        chips={
          <span className={HERO_CHIP}>
            <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
            You can pause or revoke access anytime
          </span>
        }
        actions={
          <Link href="/patient/care-team" className={HERO_GHOST}>
            <ChevronLeft size={15} aria-hidden />
            Back to care team
          </Link>
        }
      />

      <form onSubmit={onSubmit} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="cta-form">
          <PanelHeader id="cta-form" icon={<UserPlus size={16} />} tone="bg-sky-50 text-sky-600" title="Clinician details" caption="Only the name and role are required" />

          <div className="mt-6">
            <label htmlFor="cta-name" className={FIELD_LABEL}>Full name</label>
            <input
              id="cta-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Dr. Anjali Perera"
              className={FIELD_INPUT}
            />
          </div>

          <p className={cn(GROUP_LABEL, "mt-6")}>Role</p>
          <div role="radiogroup" aria-label="Role" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {ROLES.map((r) => {
              const on = role === r.value;
              const Icon = r.icon;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRole(r.value)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl px-2 py-3.5 text-center transition-all hover:-translate-y-0.5",
                    on ? "bg-sky-50/60 shadow-[inset_0_0_0_1.5px_rgba(2,132,199,0.4)]" : "hover:bg-slate-50",
                  )}
                >
                  {on ? (
                    <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-sky-600 text-white" aria-hidden>
                      <Check size={10} strokeWidth={3} />
                    </span>
                  ) : null}
                  <span className={cn("grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20", r.tone)}>
                    <Icon size={19} aria-hidden />
                  </span>
                  <span className="w-full min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-slate-900">{r.label}</span>
                    <span className="block truncate text-[11px] text-slate-400">{r.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className={cn(GROUP_LABEL, "mt-6")}>Practice</p>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cta-spec" className={FIELD_LABEL}>Specialty</label>
              <IconInput id="cta-spec" icon={<Stethoscope size={15} />} type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Cardiology" />
            </div>
            <div>
              <label htmlFor="cta-org" className={FIELD_LABEL}>Hospital / organisation</label>
              <IconInput id="cta-org" icon={<Building2 size={15} />} type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="e.g. Asiri Central Hospital" />
            </div>
          </div>

          <p className={cn(GROUP_LABEL, "mt-6")}>Contact</p>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cta-phone" className={FIELD_LABEL}>Phone</label>
              <IconInput id="cta-phone" icon={<Phone size={15} />} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 77 123 4567" />
            </div>
            <div>
              <label htmlFor="cta-email" className={FIELD_LABEL}>Email</label>
              <IconInput id="cta-email" icon={<Mail size={15} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@hospital.org" />
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="cta-notes" className={FIELD_LABEL}>
              What they help with <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="cta-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Managing blood pressure, post-op follow-up…"
              className={FIELD_TEXTAREA}
            />
          </div>

          {error ? (
            <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <AlertCircle size={14} className="shrink-0" aria-hidden />
              {error}
            </div>
          ) : null}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6 xl:col-span-4" aria-label="Preview">
          <section className={PANEL}>
            <p className={GROUP_LABEL}>Preview</p>
            <div className="mt-3 flex items-center gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br text-white shadow-md", selectedRole.tone)} aria-hidden>
                <RoleIcon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-semibold", name ? "text-slate-900" : "text-slate-300")}>
                  {name || "Clinician name"}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {[selectedRole.label, specialty, organization].filter(Boolean).join(" · ")}
                </span>
              </span>
            </div>
            {phone || email ? (
              <ul className="mt-3 flex flex-col gap-1 text-xs text-slate-500">
                {phone ? (
                  <li className="flex items-center gap-2"><Phone size={12} aria-hidden /> {phone}</li>
                ) : null}
                {email ? (
                  <li className="flex items-center gap-2 truncate"><Mail size={12} aria-hidden /> {email}</li>
                ) : null}
              </ul>
            ) : null}
          </section>
          <div className="flex items-center gap-2">
            <Link href="/patient/care-team" className={cn(SECONDARY_BTN, "h-10 flex-1 justify-center")}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={add.isPending}
              className="inline-flex h-10 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#07233a] px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700 disabled:opacity-60"
            >
              {add.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <UserPlus size={15} aria-hidden />}
              {add.isPending ? "Adding…" : "Add to care team"}
            </button>
          </div>
        </aside>
      </form>
    </PatientPage>
  );
}
