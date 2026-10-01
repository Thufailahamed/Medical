"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Contact,
  DoorOpen,
  HeartPulse,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/hospital/lib/api";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PRIMARY_BTN,
  SECONDARY_BTN,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  QuickToolsPanel,
} from "@/patient/components/workspace";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export default function NewPatientPage() {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    gender: "",
    bloodGroup: "",
    address: "",
    nic: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const filled = [form.name, form.phone, form.dob, form.gender, form.bloodGroup, form.nic].filter(Boolean).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api<{ patient: { id: string; mrn: string } }>(
        "/hospital-portal/patients",
        {
          method: "POST",
          json: {
            name: form.name,
            phone: form.phone || null,
            email: form.email || null,
            dob: form.dob || null,
            gender: form.gender || null,
            bloodGroup: form.bloodGroup || null,
            address: form.address || null,
            nic: form.nic || null,
          },
        }
      );
      toast.success(`Registered · MRN ${res.patient.mrn}`);
      router.push(`/hospital/reception/patients/${res.patient.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setSubmitting(false);
    }
  }

  const hero = (
    <DoctorHero
      kickerIcon={<UserPlus size={13} aria-hidden />}
      kicker={t("nav.reception")}
      kickerMeta={t("patients.directory")}
      title={
        <>
          {t("reception.newPatientTitle")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · MRN
          </span>
        </>
      }
      description={t("reception.newPatientSubtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <ShieldCheck size={12} className="text-emerald-300" />
            MRN assigned on save
          </span>
          <span className={HERO_CHIP}>
            <ClipboardList size={12} className="text-sky-300" />
            {filled}/6 fields filled
          </span>
        </>
      }
      actions={
        <>
          <Link href="/hospital/reception/patients" className={HERO_GHOST}>
            <ArrowLeft size={13} /> {t("common.back")}
          </Link>
          <button
            type="submit"
            form="new-patient-form"
            disabled={submitting}
            className={HERO_PRIMARY}
          >
            <UserPlus size={14} className="text-emerald-600" />
            {submitting ? t("common.loading") : t("common.submit")}
          </button>
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<UserPlus size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Identity"
          value={form.name ? "✓" : "—"}
          sub={form.name || "Legal name required"}
        />
        <StatTile
          icon={<Contact size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Contact"
          value={form.phone ? "✓" : "—"}
          sub={form.phone || "Phone required"}
        />
        <StatTile
          icon={<HeartPulse size={16} />}
          tone="bg-rose-50 text-rose-600"
          label="Clinical"
          value={form.bloodGroup || "—"}
          sub={form.bloodGroup ? "Blood group set" : "Blood group optional"}
        />
        <StatTile
          icon={<Users size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("nav.patients")}
          value="→"
          sub={t("reception.patientsSubtitle")}
          href="/hospital/reception/patients"
        />
      </HeroOverlap>

      <form id="new-patient-form" onSubmit={submit}>
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
            <section className={PANEL}>
              <PanelHeader
                icon={<UserPlus size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title="Identity"
                caption="Legal identity and registration"
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="np-name" className={FIELD_LABEL}>
                    {t("common.name")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="np-name"
                    required
                    autoFocus
                    className={FIELD_INPUT}
                    value={form.name}
                    onChange={set("name")}
                  />
                </div>
                <div>
                  <label htmlFor="np-nic" className={FIELD_LABEL}>NIC</label>
                  <input
                    id="np-nic"
                    className={FIELD_INPUT}
                    placeholder="200012345678"
                    value={form.nic}
                    onChange={set("nic")}
                  />
                </div>
                <div>
                  <label htmlFor="np-dob" className={FIELD_LABEL}>DOB</label>
                  <input
                    id="np-dob"
                    type="date"
                    className={FIELD_INPUT}
                    value={form.dob}
                    onChange={set("dob")}
                  />
                </div>
                <div>
                  <label htmlFor="np-gender" className={FIELD_LABEL}>
                    {t("patients.overview.gender")}
                  </label>
                  <select
                    id="np-gender"
                    className={FIELD_INPUT}
                    value={form.gender}
                    onChange={set("gender")}
                  >
                    <option value="">—</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<Contact size={16} />}
                tone="bg-sky-50 text-sky-600"
                title="Contact"
                caption="How the facility reaches this patient"
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="np-phone" className={FIELD_LABEL}>
                    {t("common.phone")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="np-phone"
                    required
                    type="tel"
                    className={FIELD_INPUT}
                    value={form.phone}
                    onChange={set("phone")}
                  />
                </div>
                <div>
                  <label htmlFor="np-email" className={FIELD_LABEL}>
                    {t("common.email")}
                  </label>
                  <input
                    id="np-email"
                    type="email"
                    className={FIELD_INPUT}
                    value={form.email}
                    onChange={set("email")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="np-address" className={FIELD_LABEL}>
                    {t("common.address")}
                  </label>
                  <textarea
                    id="np-address"
                    rows={2}
                    className={FIELD_TEXTAREA}
                    value={form.address}
                    onChange={set("address")}
                  />
                </div>
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-5 xl:col-span-4">
            <section className={PANEL}>
              <PanelHeader
                icon={<HeartPulse size={16} />}
                tone="bg-rose-50 text-rose-600"
                title="Clinical"
                caption="Optional baseline details"
              />
              <div className="mt-5">
                <label htmlFor="np-blood" className={FIELD_LABEL}>
                  {t("patients.overview.bloodGroup")}
                </label>
                <select
                  id="np-blood"
                  className={FIELD_INPUT}
                  value={form.bloodGroup}
                  onChange={set("bloodGroup")}
                >
                  <option value="">—</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <button type="submit" disabled={submitting} className={PRIMARY_BTN}>
                  <UserPlus size={14} aria-hidden />
                  {submitting ? t("common.loading") : t("common.submit")}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className={SECONDARY_BTN}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </section>

            <QuickToolsPanel
              id="new-patient-quick-actions"
              title={t("dashboard.quickActions")}
              tools={[
                {
                  icon: Users,
                  label: t("nav.patients"),
                  hint: "Directory",
                  href: "/hospital/reception/patients",
                  tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
                },
                {
                  icon: DoorOpen,
                  label: t("nav.walkIns"),
                  hint: "Queue",
                  href: "/hospital/reception/walk-ins",
                  tone: "from-amber-500 to-orange-600 shadow-amber-500/30",
                },
                {
                  icon: CalendarDays,
                  label: t("nav.appointments"),
                  hint: "Schedule",
                  href: "/hospital/reception/appointments",
                  tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
                },
              ]}
            />
          </aside>
        </div>
      </form>
    </div>
  );
}
