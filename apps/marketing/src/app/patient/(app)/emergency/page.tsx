"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Download,
  Heart,
  HeartHandshake,
  HeartPulse,
  Loader2,
  Phone,
  PhoneCall,
  Pill,
  Printer,
  QrCode,
  Radio,
  ShieldAlert,
  Siren,
  Users,
} from "lucide-react";

import { useEmergencyQR, usePatientProfile, useTriggerSOS } from "@/patient/hooks";
import { API_URL } from "@/portal/lib/api";
import {
  HERO_CHIP,
  HERO_DANGER_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";

type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

function parseContacts(v?: string | null | unknown): EmergencyContact[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .filter((c) => c && typeof c === "object")
      .map((c) => {
        const row = c as Record<string, unknown>;
        return {
          name: String(row.name || "").trim(),
          relationship: String(row.relationship || "").trim(),
          phone: String(row.phone || "").trim(),
        };
      })
      .filter((c) => c.name || c.phone);
  }
  if (typeof v !== "string") return [];
  try {
    return parseContacts(JSON.parse(v));
  } catch {
    return [];
  }
}

function parseList(v?: string | string[] | null): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  try {
    const arr = JSON.parse(v);
    if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
  } catch {
    return [v];
  }
  return [];
}

const EMERGENCY_SERVICES = [
  {
    name: "Suwa Seriya Ambulance",
    number: "1990",
    desc: "Free 24/7 National Pre-Hospital Care",
    badge: "Medical Emergency",
  },
  {
    name: "National Police Service",
    number: "119",
    desc: "24/7 Law Enforcement Emergency",
    badge: "Police Emergency",
  },
  {
    name: "National Hospital Colombo",
    number: "0112691111",
    desc: "Trauma & Accident Emergency Service",
    badge: "Trauma Service",
  },
  {
    name: "National Poison Information",
    number: "0112686143",
    desc: "Toxicology & Antidote Registry",
    badge: "Poison Hotline",
  },
];

export default function EmergencyPage() {
  const profile = usePatientProfile();
  const qrQuery = useEmergencyQR();
  const sos = useTriggerSOS();

  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState("");

  const patient = (
    profile.data as
      | {
          patient?: {
            patients?: Record<string, unknown>;
            users?: Record<string, unknown>;
          };
        }
      | undefined
  )?.patient;
  const patientRow = patient?.patients;
  const userRow = patient?.users;
  const qrData = qrQuery.data?.qrData;

  const profileName = String(userRow?.name || qrData?.name || "Patient");
  const contacts = useMemo(
    () =>
      parseContacts(
        (patientRow?.emergencyContacts as string | null) ?? qrData?.contacts,
      ),
    [patientRow?.emergencyContacts, qrData?.contacts],
  );
  const allergies = useMemo(
    () =>
      parseList(
        (patientRow?.allergies as string | string[] | null) ??
          (qrData?.allergies as string | string[] | null),
      ),
    [patientRow?.allergies, qrData?.allergies],
  );
  const conditions = useMemo(
    () =>
      parseList(
        (patientRow?.medicalConditions as string | string[] | null) ??
          (qrData?.conditions as string | string[] | null),
      ),
    [patientRow?.medicalConditions, qrData?.conditions],
  );
  const currentMeds = qrData?.currentMedicines ?? [];
  const bloodType =
    (patientRow?.bloodGroup as string | null) || qrData?.bloodGroup || "B+";
  const phone = (userRow?.phone as string | null) || qrData?.phone || null;

  const qrString = useMemo(() => {
    const payload = {
      v: 1,
      id: (userRow?.id as string | null) || qrData?.id || null,
      name: profileName,
      bloodGroup: bloodType,
      allergies,
      conditions,
      phone,
      contacts,
    };
    const base64 =
      typeof btoa === "function"
        ? btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
        : Buffer.from(JSON.stringify(payload)).toString("base64");
    return `${API_URL}/emergency/card/view?data=${encodeURIComponent(base64)}`;
  }, [userRow?.id, qrData?.id, profileName, bloodType, allergies, conditions, phone, contacts]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrString, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 280,
      color: { dark: "#0B1F3A", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [qrString]);

  async function sendSos() {
    if (!window.confirm("Send an urgent emergency SOS to your configured contacts and locate the nearest trauma center?")) {
      return;
    }
    setError(null);
    setSent(null);
    try {
      const response = await sos.mutateAsync({});
      setSent(
        response.nearestHospital?.name
          ? `SOS dispatched! Nearest trauma center: ${response.nearestHospital.name}. Emergency contacts alerted.`
          : "SOS dispatched to your emergency contacts network.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send SOS.");
    }
  }

  const printCard = () => {
    window.print();
  };

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<HeartPulse size={13} aria-hidden />}
        kicker="Family & Safety"
        kickerMeta="Medical ID & SOS hub"
        title={
          <>
            Emergency <HeroAccent>medical ID</HeroAccent>
          </>
        }
        description="Critical life-saving clinical summary for first responders and ER teams — instantly scannable without a device passcode."
        chips={
          <>
            <span className={HERO_DANGER_CHIP}>
              <Heart size={12} />
              Type {bloodType}
            </span>
            <span className={HERO_CHIP}>
              <PhoneCall size={12} className="text-sky-300" />
              {contacts.length} ICE contact{contacts.length === 1 ? "" : "s"}
            </span>
            {allergies.length > 0 ? (
              <span className={HERO_DANGER_CHIP}>
                <ShieldAlert size={12} />
                {allergies.length} allerg{allergies.length === 1 ? "y" : "ies"} flagged
              </span>
            ) : null}
            <span className={HERO_CHIP}>QR medical pass ready</span>
          </>
        }
        actions={
          <>
            <a href="tel:1990" className={HERO_GHOST}>
              <Ambulance size={14} className="text-rose-300" /> Call 1990
            </a>
            <button
              type="button"
              onClick={sendSos}
              disabled={sos.isPending}
              className={HERO_PRIMARY}
            >
              {sos.isPending ? (
                <Loader2 size={14} className="animate-spin text-sky-600" />
              ) : (
                <Radio size={14} className="text-rose-600" />
              )}
              Send SOS
            </button>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Heart size={16} />}
          tone="bg-rose-50 text-rose-600"
          label="Blood group"
          value={bloodType}
          sub="On your medical ID"
        />
        <StatTile
          icon={<PhoneCall size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="ICE contacts"
          value={String(contacts.length)}
          sub={contacts.length > 0 ? "Alerted on SOS" : "None configured"}
          pulse={contacts.length === 0}
        />
        <StatTile
          icon={<ShieldAlert size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Allergies"
          value={String(allergies.length)}
          sub={allergies.length > 0 ? "Flagged for responders" : "None on file"}
        />
        <StatTile
          icon={<Pill size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Medications"
          value={String(currentMeds.length)}
          sub="Active prescriptions"
        />
      </HeroOverlap>

      {sent ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-700">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{sent}</span>
        </div>
      ) : null}
      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-600">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          {/* ── Official Emergency Medical ID Card ─────────────────────── */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)]">
            <div
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-white sm:px-7"
              style={{ background: "linear-gradient(135deg, #07233a 0%, #0b2f4d 100%)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-rose-600 text-white">
                  <HeartPulse size={16} />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider">
                    Emergency Medical ID
                  </p>
                  <p className="text-[10px] text-white/70">
                    Authorized first responder clinical summary
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printCard}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <Printer size={13} />
                  <span>Print card</span>
                </button>
                {qrUrl ? (
                  <a
                    href={qrUrl}
                    download={`emergency-qr-${profileName.toLowerCase().replace(/\s+/g, "-")}.png`}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <Download size={13} />
                    <span>Save QR</span>
                  </a>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-center gap-6 p-5 sm:p-7 md:flex-row md:items-start">
              <div className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
                {qrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrUrl}
                    alt="Emergency QR Pass"
                    width={200}
                    height={200}
                    className="rounded-lg border border-slate-100 bg-white p-1"
                  />
                ) : (
                  <div className="flex h-[200px] w-[200px] items-center justify-center text-xs text-slate-400">
                    Generating QR…
                  </div>
                )}
                <p className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Scan without passcode
                </p>
              </div>

              <div className="flex w-full flex-1 flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-xl font-semibold leading-tight tracking-[-0.02em] text-slate-900 sm:text-2xl">
                      {profileName}
                    </h2>
                    <div className="mt-1 flex items-center gap-3 text-xs font-medium text-slate-500">
                      {phone ? (
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" />
                          <a href={`tel:${phone}`} className="font-bold text-sky-700 hover:underline">
                            {phone}
                          </a>
                        </span>
                      ) : null}
                      <span>·</span>
                      <span className="text-slate-500">ID: HealthHub-LK</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2">
                    <Heart size={18} className="fill-rose-500 text-rose-500" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                        Blood group
                      </p>
                      <p className="text-lg font-semibold leading-none text-rose-600">
                        {bloodType}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                  <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      <ShieldAlert size={12} className="text-rose-500" />
                      Known allergies
                    </span>
                    {allergies.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {allergies.map((a) => (
                          <span
                            key={a}
                            className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        No confirmed drug allergies on file
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      <Activity size={12} className="text-sky-600" />
                      Chronic conditions
                    </span>
                    {conditions.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {conditions.map((c) => (
                          <span
                            key={c}
                            className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        No chronic medical conditions listed
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:col-span-2">
                    <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      <Pill size={12} className="text-emerald-600" />
                      Active medications &amp; dosages
                    </span>
                    {currentMeds.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {currentMeds.map((m, i) => (
                          <span
                            key={i}
                            className="flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          >
                            <span className="font-bold">{m.name}</span>
                            {m.dosage ? <span className="opacity-80">({m.dosage})</span> : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        No active medications recorded
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── ICE contacts ────────────────────────────────────────────── */}
          <section className={PANEL}>
            <PanelHeader
              icon={<PhoneCall size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="In case of emergency (ICE) contacts"
              caption="These contacts get instant SMS and push alerts when you trigger the SOS."
              href="/patient/family"
              linkLabel="Manage contacts"
            />
            {contacts.length === 0 ? (
              <div className="mt-5 flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-6 sm:flex-row">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      No emergency contacts configured
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Designate a family member or doctor so responders can notify them.
                    </p>
                  </div>
                </div>
                <Link
                  href="/patient/family"
                  className="inline-flex h-9 shrink-0 items-center rounded-lg bg-white px-4 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700"
                >
                  + Add ICE contact
                </Link>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {contacts.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{c.name}</p>
                      <p className="truncate text-[11px] capitalize text-slate-500">
                        {c.relationship || "Emergency contact"}
                      </p>
                    </div>
                    {c.phone ? (
                      <a
                        href={`tel:${c.phone}`}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white transition hover:bg-sky-500"
                      >
                        <Phone size={12} /> Call
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<Siren size={16} />}
              tone="bg-rose-50 text-rose-600"
              title="Emergency hotlines"
              caption="National services — tap to call."
            />
            <div className="mt-5 flex flex-col gap-2.5">
              {EMERGENCY_SERVICES.map((srv) => (
                <a
                  key={srv.number}
                  href={`tel:${srv.number}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3.5 transition-all hover:-translate-y-px hover:border-rose-200 hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition-colors group-hover:bg-rose-50 group-hover:text-rose-600">
                        {srv.badge}
                      </span>
                    </div>
                    <h4 className="mt-1.5 truncate text-sm font-bold text-slate-900">
                      {srv.name}
                    </h4>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{srv.desc}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-base font-bold tabular-nums tracking-tight text-rose-600">
                      {srv.number}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 transition-colors group-hover:text-rose-600">
                      <PhoneCall size={11} /> Call
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <QuickToolsPanel
            id="em-tools"
            title="Family & Safety"
            tools={[
              {
                icon: Users,
                label: "Family",
                hint: "Members",
                href: "/patient/family",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: HeartHandshake,
                label: "Caretakers",
                hint: "Delegate access",
                href: "/patient/caretakers",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: QrCode,
                label: "Health ID",
                hint: "Rotating QR",
                href: "/patient/health-id",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />

          <PromoCard
            icon={<QrCode size={21} aria-hidden />}
            kicker="Everyday pass"
            title="Health ID smart pass"
            body="A rotating cryptographic QR for hospital check-in, pharmacy, and labs — separate from this emergency card."
            href="/patient/health-id"
          />
        </div>
      </div>
    </PatientPage>
  );
}
