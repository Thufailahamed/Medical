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
  ChevronRight,
  Download,
  ExternalLink,
  Heart,
  HeartPulse,
  Loader2,
  Phone,
  PhoneCall,
  Pill,
  Printer,
  QrCode,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from "lucide-react";

import { useEmergencyQR, usePatientProfile, useTriggerSOS } from "@/patient/hooks";
import { API_URL } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";

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
    color: "from-rose-600 to-red-700",
  },
  {
    name: "National Police Service",
    number: "119",
    desc: "24/7 Law Enforcement Emergency",
    badge: "Police Emergency",
    color: "from-sky-700 to-indigo-900",
  },
  {
    name: "National Hospital Colombo",
    number: "0112691111",
    desc: "Trauma & Accident Emergency Service",
    badge: "Trauma Service",
    color: "from-emerald-700 to-teal-800",
  },
  {
    name: "National Poison Information",
    number: "0112686143",
    desc: "Toxicology & Antidote Registry",
    badge: "Poison Hotline",
    color: "from-amber-600 to-yellow-700",
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
                <HeartPulse size={12} className="text-rose-300 animate-pulse" />
                Emergency Medical ID &amp; SOS Hub
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Emergency Care &amp; Medical ID
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Critical life-saving clinical summary for first responders and ER trauma surgeons. Instantly scannable without device passcodes.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <a
                href="tel:1990"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-all hover:scale-[1.02]"
              >
                <Ambulance size={14} />
                <span>Call 1990 Ambulance</span>
              </a>

              <button
                type="button"
                onClick={sendSos}
                disabled={sos.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02] cursor-pointer disabled:opacity-50"
              >
                {sos.isPending ? (
                  <Loader2 size={14} className="animate-spin text-rose-600" />
                ) : (
                  <Radio size={14} className="text-rose-600 animate-pulse" />
                )}
                <span>Send Emergency SOS</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-rose-500/30 flex items-center justify-center text-rose-200 shrink-0 font-black text-xs">
                {bloodType}
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Blood Group
                </p>
                <p className="text-base font-extrabold text-white">
                  Type {bloodType}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <PhoneCall size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  ICE Contacts
                </p>
                <p className="text-base font-extrabold text-white">
                  {contacts.length} Configured
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <ShieldAlert size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Allergies
                </p>
                <p className="text-base font-extrabold text-white">
                  {allergies.length} Flagged
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <QrCode size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  QR Medical Pass
                </p>
                <p className="text-base font-extrabold text-white">Active Ready</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* SOS Feedback Alert */}
      {sent && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900 flex items-center gap-3 shadow-xs">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{sent}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-900 flex items-center gap-3 shadow-xs">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 2. Official Emergency Medical ID Card ───────────────────────────── */}
      <section className="rounded-2xl border-2 border-slate-200/90 bg-white shadow-md overflow-hidden">
        {/* Card Header Strip */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 px-5 sm:px-7 py-3.5 text-white flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-rose-600 flex items-center justify-center text-white shadow-2xs">
              <HeartPulse size={16} />
            </div>
            <div>
              <p className="text-xs font-extrabold tracking-wider uppercase text-white">
                Emergency Medical ID
              </p>
              <p className="text-[10px] text-white/70">
                Authorized First Responder Clinical Summary
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={printCard}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors cursor-pointer"
            >
              <Printer size={13} />
              <span>Print Card</span>
            </button>
            {qrUrl && (
              <a
                href={qrUrl}
                download={`emergency-qr-${profileName.toLowerCase().replace(/\s+/g, "-")}.png`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>Save QR</span>
              </a>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 sm:p-7 flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* High Res QR Frame */}
          <div className="shrink-0 flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt="Emergency QR Pass"
                width={200}
                height={200}
                className="rounded-xl border border-slate-200 bg-white p-1"
              />
            ) : (
              <div className="flex h-[200px] w-[200px] items-center justify-center text-xs text-slate-400">
                Generating QR…
              </div>
            )}
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">
              Scan Without Passcode
            </p>
          </div>

          {/* Patient Vitals & Identification */}
          <div className="flex-1 flex flex-col gap-4 w-full">
            <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                  {profileName}
                </h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                  {phone ? (
                    <span className="flex items-center gap-1">
                      <Phone size={12} className="text-slate-400" />
                      <a href={`tel:${phone}`} className="font-bold text-sky-700 hover:underline">
                        {phone}
                      </a>
                    </span>
                  ) : null}
                  <span>·</span>
                  <span className="text-slate-600">ID: HealthHub-LK</span>
                </div>
              </div>

              {/* Prominent Blood Group Badge */}
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-rose-50 border-2 border-rose-300 shadow-2xs">
                <Heart size={18} className="text-rose-600 fill-rose-600" />
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700">
                    Blood Group
                  </p>
                  <p className="text-lg font-black text-rose-950 leading-none">
                    {bloodType}
                  </p>
                </div>
              </div>
            </div>

            {/* Critical Clinical Snapshot Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <ShieldAlert size={12} className="text-rose-600" />
                  Known Allergies
                </span>
                {allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {allergies.map((a) => (
                      <span
                        key={a}
                        className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    No confirmed drug allergies on file
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Activity size={12} className="text-sky-600" />
                  Chronic Conditions
                </span>
                {conditions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {conditions.map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded-md text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    No chronic medical conditions listed
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1 sm:col-span-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Pill size={12} className="text-emerald-600" />
                  Active Medications &amp; Dosages
                </span>
                {currentMeds.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {currentMeds.map((m, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1"
                      >
                        <span className="font-bold">{m.name}</span>
                        {m.dosage ? (
                          <span className="text-emerald-600">({m.dosage})</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    No active medications recorded
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. National Emergency Speed Dials ───────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <Siren size={15} className="text-rose-600" />
          <span>National Emergency Services &amp; Hotlines</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {EMERGENCY_SERVICES.map((srv) => (
            <a
              key={srv.number}
              href={`tel:${srv.number}`}
              className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-rose-300 transition-all flex flex-col justify-between gap-3 group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 group-hover:bg-rose-50 group-hover:text-rose-700 transition-colors">
                    {srv.badge}
                  </span>
                  <PhoneCall size={14} className="text-slate-400 group-hover:text-rose-600 transition-colors" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-2">
                  {srv.name}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {srv.desc}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-base font-black text-rose-700 tracking-tight">
                  {srv.number}
                </span>
                <span className="text-xs font-bold text-slate-600 group-hover:text-rose-700 transition-colors">
                  Tap to Call →
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── 4. In Case of Emergency (ICE) Contacts ──────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <PhoneCall size={16} className="text-sky-600" />
              <span>In Case of Emergency (ICE) Contacts</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These contacts receive immediate SMS and push notification alerts when you trigger the SOS alarm.
            </p>
          </div>

          <Link
            href="/patient/family"
            className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1"
          >
            <span>Manage Contacts</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        {contacts.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  No Emergency Contacts Configured
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Designate a family member or primary doctor as your emergency contact so responders can notify them.
                </p>
              </div>
            </div>

            <Link
              href="/patient/family"
              className="px-4 py-2 rounded-xl text-xs font-bold text-sky-800 bg-white border border-sky-200/80 hover:bg-sky-50 transition-colors shrink-0"
            >
              + Add ICE Contact
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {contacts.map((c, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">
                    {c.name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate capitalize">
                    {c.relationship || "Emergency Contact"}
                  </p>
                </div>

                {c.phone ? (
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-2xs transition-colors shrink-0"
                  >
                    <Phone size={12} />
                    <span>Call</span>
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Responder Security & Encryption Notice ──────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Paramedic Scannable Without Passcode
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Your Emergency QR can be scanned directly from your lock screen wallpaper by paramedics and ER teams to access critical blood type and allergy data safely.
            </p>
          </div>
        </div>

        <Link
          href="/patient/health-id"
          className="px-4 py-2 rounded-xl text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <ExternalLink size={13} className="text-sky-700" />
          <span>Health ID Pass</span>
        </Link>
      </section>
    </div>
  );
}
