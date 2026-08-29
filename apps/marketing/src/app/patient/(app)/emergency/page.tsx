"use client";

import { useState } from "react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api } from "@/portal/lib/api";
import { useMutation, useQuery } from "@tanstack/react-query";

export default function EmergencyPage() {
  const profile = useQuery({
    queryKey: ["patient", "emergency", "qr"],
    queryFn: () => api<{ qrData: unknown }>("/emergency/qr"),
  });
  const sos = useMutation({
    mutationFn: () => api<{ emergency: { id: string }; nearestHospital?: { name: string } | null }>("/emergency/sos", { method: "POST", json: {} }),
  });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function sendSos() {
    if (!window.confirm("Send an emergency SOS to your configured contacts?")) return;
    setError(null);
    setSent(null);
    try {
      const response = await sos.mutateAsync();
      setSent(response.nearestHospital?.name ? `SOS sent. Nearest hospital: ${response.nearestHospital.name}` : "SOS sent to your emergency network.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send SOS.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader label="Safety" title="Emergency" description="Keep your emergency profile ready and contact help when you need it." />
      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text">Emergency profile</h2>
          {profile.isLoading ? <p className="text-sm text-text-soft">Loading your emergency profile…</p> : profile.error ? <p role="alert" className="text-sm text-danger">Could not load your emergency profile. Retry the page to try again.</p> : <p className="text-sm text-text-soft">Your emergency QR data is available to authorized responders through the server.</p>}
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          {sent ? <p role="status" className="text-sm font-semibold text-success">{sent}</p> : null}
          <button type="button" onClick={sendSos} disabled={sos.isPending} className="self-start rounded-pill bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {sos.isPending ? "Sending SOS…" : "Send emergency SOS"}
          </button>
        </div>
      </Card>
    </div>
  );
}
