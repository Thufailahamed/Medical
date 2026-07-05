"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Phone, Mail, Droplet } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { ageFrom } from "@/portal/lib/format";

export interface PatientHeaderData {
  patient: {
    id: string;
    nic?: string | null;
    dob?: string | null;
    sex?: string | null;
    bloodGroup?: string | null;
    photo?: string | null;
  };
  user: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  allergies: Array<{ id: string; substance: string; severity: string; reaction?: string | null }>;
  chronicConditions: Array<{ id: string; name: string; since?: string | null }>;
}

export function usePatientHeader(patientId: string) {
  return useQuery({
    queryKey: ["patient", "header", patientId],
    queryFn: () => api<PatientHeaderData>(`/patients/${patientId}`),
    enabled: !!patientId,
  });
}

export function PatientHeader({ data }: { data?: PatientHeaderData }) {
  if (!data) {
    return (
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
    );
  }
  const { patient, user, allergies, chronicConditions } = data;
  const age = patient.dob ? ageFrom(patient.dob) : null;
  const hasAllergies = allergies.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <Avatar
          name={user.name}
          src={patient.photo ?? undefined}
          size="lg"
          className="h-16 w-16 text-base"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-text truncate">{user.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-text-soft">
            {age != null ? <span>{age}y · {patient.sex ?? "—"}</span> : null}
            {patient.nic ? <span>NIC {patient.nic}</span> : null}
            {user.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone size={11} /> {user.phone}
              </span>
            ) : null}
            {user.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail size={11} /> {user.email}
              </span>
            ) : null}
          </div>
        </div>
        {patient.bloodGroup ? (
          <div className="flex flex-col items-end shrink-0">
            <div className="text-[10px] text-text-muted uppercase tracking-wide flex items-center gap-1">
              <Droplet size={11} /> Blood
            </div>
            <div className="text-lg font-semibold text-text">{patient.bloodGroup}</div>
          </div>
        ) : null}
      </div>

      {hasAllergies ? (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2">
          <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />
          <div className="text-xs text-danger">
            <div className="font-semibold mb-1">Allergies on file</div>
            <div className="flex flex-wrap gap-1.5">
              {allergies.map((a) => (
                <Pill key={a.id} tone="danger">
                  {a.substance} · {a.severity}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {chronicConditions.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-text-soft">
          <span className="font-medium">Chronic:</span>
          {chronicConditions.map((c) => (
            <Pill key={c.id} tone="warn">
              {c.name}
            </Pill>
          ))}
        </div>
      ) : null}
    </div>
  );
}