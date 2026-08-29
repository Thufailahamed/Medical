"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, Mail, Phone, User, MapPin, Heart, Calendar } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useProfile, usePatientProfile } from "@/patient/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/portal/lib/api";
import { patientKeys, patientPaths } from "@healthcare/shared/contracts";

export default function EditProfilePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useProfile();
  const patient = usePatientProfile();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Sri Lanka");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated && profile.data) {
      setName(profile.data.name ?? "");
      setEmail(profile.data.email ?? "");
      setPhone(profile.data.phone ?? "");
      setHydrated(true);
    }
  }, [profile.data, hydrated]);

  useEffect(() => {
    if (patient.data?.patient) {
      const p = patient.data.patient.patients;
      if (p.dateOfBirth) setDateOfBirth(p.dateOfBirth);
      if (p.gender) setGender(p.gender);
    }
  }, [patient.data]);

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

  async function onSubmit(event: React.FormEvent) {
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

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/profile"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to profile
      </Link>

      <SectionHeader
        label="You"
        title="Edit profile"
        description="Keep your contact and demographic information up to date. Your care team relies on this for emergencies."
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Card>
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-text">Personal</h2>

            <div>
              <label htmlFor="name" className="t-label block">
                Full name
              </label>
              <div className="relative mt-2">
                <User
                  size={14}
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="t-label block">
                  Email
                </label>
                <div className="relative mt-2">
                  <Mail
                    size={14}
                    aria-hidden
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="t-label block">
                  Phone
                </label>
                <div className="relative mt-2">
                  <Phone
                    size={14}
                    aria-hidden
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-text">Demographics</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="dob" className="t-label block">
                  Date of birth
                </label>
                <input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
                />
              </div>
              <div>
                <label htmlFor="gender" className="t-label block">
                  Gender
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label htmlFor="blood" className="t-label block">
                  Blood group
                </label>
                <select
                  id="blood"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
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
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-text">Address</h2>
            <div>
              <label htmlFor="address" className="t-label block">
                Street address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Apt 4B"
                className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="city" className="t-label block">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Colombo"
                  className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
                />
              </div>
              <div>
                <label htmlFor="country" className="t-label block">
                  Country
                </label>
                <input
                  id="country"
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-text">Emergency contact</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="emergency-name" className="t-label block">
                  Name
                </label>
                <input
                  id="emergency-name"
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="e.g. Spouse, parent"
                  className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
                />
              </div>
              <div>
                <label htmlFor="emergency-phone" className="t-label block">
                  Phone
                </label>
                <input
                  id="emergency-phone"
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="mt-2 h-11 w-full rounded-inner border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>
        </Card>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={update.isPending}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={14} aria-hidden />
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
          <Link
            href="/patient/profile"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border px-5 py-2.5 text-sm font-semibold text-text-soft"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
