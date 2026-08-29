"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useEmergencyQR, usePatientProfile, useTriggerSOS } from "@/patient/hooks";
import { API_URL } from "@/portal/lib/api";

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

export default function EmergencyPage() {
  const profile = usePatientProfile();
  const qrQuery = useEmergencyQR();
  const sos = useTriggerSOS();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState("");

  const patient = (profile.data as { patient?: { patients?: Record<string, unknown>; users?: Record<string, unknown> } } | undefined)
    ?.patient;
  const patientRow = patient?.patients;
  const userRow = patient?.users;
  const qrData = qrQuery.data?.qrData;

  const profileName = String(userRow?.name || qrData?.name || "—");
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
    (patientRow?.bloodGroup as string | null) || qrData?.bloodGroup || null;
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
      width: 240,
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
    if (!window.confirm("Send an emergency SOS to your configured contacts?")) {
      return;
    }
    setError(null);
    setSent(null);
    try {
      const response = await sos.mutateAsync({});
      setSent(
        response.nearestHospital?.name
          ? `SOS sent. Nearest hospital: ${response.nearestHospital.name}`
          : "SOS sent to your emergency network.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send SOS.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Safety"
        title="Emergency"
        description="Keep your emergency profile ready and contact help when you need it."
      />

      <Card>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-inner bg-white p-3">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="Emergency profile QR code" width={240} height={240} />
            ) : (
              <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-text-soft">
                {qrQuery.isLoading || profile.isLoading
                  ? "Generating QR…"
                  : "QR unavailable"}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 className="text-lg font-bold text-text">{profileName}</h2>
            {bloodType ? (
              <p className="text-sm text-text-soft">
                Blood group: <span className="font-semibold text-text">{bloodType}</span>
              </p>
            ) : null}
            {phone ? (
              <p className="text-sm text-text-soft">
                Phone:{" "}
                <a href={`tel:${phone}`} className="font-semibold text-brand">
                  {phone}
                </a>
              </p>
            ) : null}
            <p className="text-xs text-text-soft">
              Responders can scan this QR to open your emergency card.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Allergies</h2>
        {allergies.length ? (
          <div className="flex flex-wrap gap-2">
            {allergies.map((a) => (
              <Pill key={a} tone="danger">
                {a}
              </Pill>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-soft">No allergies on file.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Conditions</h2>
        {conditions.length ? (
          <ul className="list-inside list-disc text-sm text-text">
            {conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-soft">No conditions on file.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Current medicines</h2>
        {currentMeds.length ? (
          <ul className="flex flex-col gap-2">
            {currentMeds.map((m, i) => (
              <li key={`${m.name}-${i}`} className="text-sm text-text">
                <span className="font-semibold">{m.name}</span>
                {m.dosage ? (
                  <span className="text-text-soft"> · {m.dosage}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-soft">No active medicines listed.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Emergency contacts</h2>
        {contacts.length ? (
          <ul className="flex flex-col gap-2">
            {contacts.map((c, i) => (
              <li
                key={`${c.name}-${i}`}
                className="flex items-center justify-between gap-3 rounded-inner bg-surface-2 px-3 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">{c.name}</span>
                  <span className="text-xs text-text-soft">
                    {c.relationship || "Contact"}
                  </span>
                </span>
                {c.phone ? (
                  <a
                    href={`tel:${c.phone}`}
                    className="rounded-pill bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Call
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-soft">No emergency contacts configured.</p>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {sent ? (
            <p role="status" className="text-sm font-semibold text-success">
              {sent}
            </p>
          ) : null}
          <button
            type="button"
            onClick={sendSos}
            disabled={sos.isPending}
            className="self-start rounded-pill bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {sos.isPending ? "Sending SOS…" : "Send emergency SOS"}
          </button>
        </div>
      </Card>
    </div>
  );
}
