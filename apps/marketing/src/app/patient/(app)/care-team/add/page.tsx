"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, UserPlus, Save, Stethoscope } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useAddCareTeamMember } from "@/patient/hooks/care-team";

const ROLES = [
  { value: "primary_doctor", label: "Primary doctor" },
  { value: "specialist", label: "Specialist" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "nurse", label: "Nurse" },
  { value: "other", label: "Other" },
] as const;

export default function AddCareTeamPage() {
  const router = useRouter();
  const add = useAddCareTeamMember();
  const [name, setName] = useState("");
  const [role, setRole] = useState<typeof ROLES[number]["value"]>("primary_doctor");
  const [specialty, setSpecialty] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
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
      setError(err instanceof Error ? err.message : "Could not add member.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/care-team"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to care team
      </Link>

      <SectionHeader
        label="Care team"
        title="Add a member"
        description="Track everyone involved in your care — primary doctor, specialists, pharmacist, nurse, family."
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="t-label block">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Dr. Anjali Perera"
                className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="t-label block">Role</label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`rounded-pill border px-3 py-2 text-xs font-semibold transition-colors ${
                      role === r.value
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-surface-1 text-text-soft hover:border-brand"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="specialty" className="t-label block">
                Specialty <span className="text-text-muted">(optional)</span>
              </label>
              <input
                id="specialty"
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Cardiology"
                className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="org" className="t-label block">
                Organization <span className="text-text-muted">(optional)</span>
              </label>
              <input
                id="org"
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Asiri Central Hospital"
                className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="t-label block">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                />
              </div>
              <div>
                <label htmlFor="email" className="t-label block">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="t-label block">
                Notes <span className="text-text-muted">(optional)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Why they're on your team, what they treat, etc."
                className="mt-2 w-full rounded-inner border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-brand"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={add.isPending}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={14} aria-hidden />
            {add.isPending ? "Saving…" : "Add to team"}
          </button>
          <Link
            href="/patient/care-team"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border px-5 py-2.5 text-sm font-semibold text-text-soft"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
