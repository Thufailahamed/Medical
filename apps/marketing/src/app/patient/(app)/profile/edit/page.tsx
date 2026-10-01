"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  Heart,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
  UserCheck,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useProfile, usePatientProfile } from "@/patient/hooks";
import type { PatientProfileResponse } from "@/patient/hooks/profile";
import type { AuthUser } from "@/portal/stores/auth";
import { api } from "@/portal/lib/api";
import { patientKeys, patientPaths } from "@healthcare/shared/contracts";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_GHOST,
  HeroAccent,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
} from "@/patient/components/workspace";

function Field({
  label,
  htmlFor,
  icon,
  children,
}: {
  label: string;
  htmlFor: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={FIELD_LABEL}>
        {label}
      </label>
      <div className="relative mt-1.5">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function EditProfileForm({
  user,
  patientRow,
}: {
  user: AuthUser | null;
  patientRow?: PatientProfileResponse["patient"]["patients"];
}) {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(patientRow?.dateOfBirth ?? "");
  const [gender, setGender] = useState(patientRow?.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Sri Lanka");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api(patientPaths.profile.me(), {
        method: "PATCH",
        json: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.profile() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
      router.push("/patient/profile");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    },
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    update.mutate({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      bloodGroup: bloodGroup || null,
      address: address.trim() || null,
      city: city.trim() || null,
      country: country.trim() || null,
      emergencyContact: emergencyContact.trim() || null,
      emergencyPhone: emergencyPhone.trim() || null,
      allergies: allergies.trim() || null,
    });
  }

  const iconInput = FIELD_INPUT + " pl-9";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <section className={PANEL}>
        <PanelHeader
          icon={<User size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Personal"
          caption="Name and primary contact channels."
        />
        <div className="mt-4 flex flex-col gap-4">
          <Field label="Full name" htmlFor="name" icon={<User size={14} aria-hidden />}>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={iconInput}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" icon={<Mail size={14} aria-hidden />}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={iconInput}
              />
            </Field>
            <Field label="Phone" htmlFor="phone" icon={<Phone size={14} aria-hidden />}>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={iconInput}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className={PANEL}>
        <PanelHeader
          icon={<Heart size={16} />}
          tone="bg-rose-50 text-rose-600"
          title="Demographics"
          caption="Used by your care team in emergencies."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="dob" className={FIELD_LABEL}>
              Date of birth
            </label>
            <input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor="gender" className={FIELD_LABEL}>
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={FIELD_INPUT}
            >
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label htmlFor="blood" className={FIELD_LABEL}>
              Blood group
            </label>
            <select
              id="blood"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className={FIELD_INPUT}
            >
              <option value="">Select…</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="allergies" className={FIELD_LABEL}>
            Allergies summary
          </label>
          <input
            id="allergies"
            type="text"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="e.g. Penicillin, peanuts"
            className={FIELD_INPUT}
          />
        </div>
      </section>

      <section className={PANEL}>
        <PanelHeader
          icon={<MapPin size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          title="Address"
          caption="Residential address for correspondence."
        />
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="address" className={FIELD_LABEL}>
              Street address
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Apt 4B"
              className={FIELD_INPUT}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={FIELD_LABEL}>
                City
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Colombo"
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label htmlFor="country" className={FIELD_LABEL}>
                Country
              </label>
              <input
                id="country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
          </div>
        </div>
      </section>

      <section className={PANEL}>
        <PanelHeader
          icon={<Phone size={16} />}
          tone="bg-amber-50 text-amber-600"
          title="Emergency contact"
          caption="Person contacted if you can't be reached."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="emergency-name" className={FIELD_LABEL}>
              Name
            </label>
            <input
              id="emergency-name"
              type="text"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="e.g. Spouse, parent"
              className={FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor="emergency-phone" className={FIELD_LABEL}>
              Phone
            </label>
            <input
              id="emergency-phone"
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              className={FIELD_INPUT}
            />
          </div>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"
        >
          <AlertCircle size={14} className="shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={update.isPending}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-sky-600 px-5 text-sm font-bold text-white transition hover:bg-sky-500 disabled:opacity-60"
        >
          <Save size={14} aria-hidden />
          {update.isPending ? "Saving…" : "Save changes"}
        </button>
        <Link
          href="/patient/profile"
          className="inline-flex h-11 items-center rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default function EditProfilePage() {
  const profile = useProfile();
  const patient = usePatientProfile();

  const ready = Boolean(profile.data) && !patient.isLoading;

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<UserCheck size={13} aria-hidden />}
        kicker="Profile"
        kickerMeta="Edit"
        title={
          <>
            Edit <HeroAccent>profile</HeroAccent>
          </>
        }
        description="Keep your contact and demographic information up to date — your care team relies on this in emergencies."
        chips={
          <>
            <Link
              href="/patient/profile"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 transition-colors hover:text-white"
            >
              <ChevronLeft size={14} aria-hidden /> Back to profile
            </Link>
          </>
        }
        actions={
          <Link href="/patient/profile" className={HERO_GHOST}>
            <Calendar size={13} /> View profile
          </Link>
        }
        overlap={false}
      />

      {ready ? (
        <EditProfileForm
          user={profile.data ?? null}
          patientRow={patient.data?.patient?.patients}
        />
      ) : (
        <PanelSkeleton rows={4} />
      )}
    </PatientPage>
  );
}
