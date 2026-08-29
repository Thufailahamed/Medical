"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";

interface CareTeamMember { id: string; doctorName: string; doctorSpecialization: string; role: string; scope: string; status: "active" | "paused" | "revoked"; }

export default function CareTeamPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const qc = useQueryClient();
  const team = useQuery({ queryKey: ["patient", "care-team", patientId], queryFn: () => api<{ members: CareTeamMember[] }>(`/care-team?patientId=${encodeURIComponent(patientId)}`), enabled: Boolean(patientId) });
  const update = useMutation({ mutationFn: ({ id, status }: { id: string; status: "active" | "paused" | "revoked" }) => api(`/care-team/${id}`, { method: "PATCH", json: { status } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", "care-team", patientId] }) });

  return <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2"><SectionHeader label="Your clinicians" title="Care team" description="Review and manage the clinicians connected to your health record." /><Card><QueryBoundary query={team} loadingCount={3} emptyTitle="No care team members" emptyDescription="Doctors you connect with will appear here.">{(data) => <ul className="flex flex-col gap-2">{data.members.map((member) => <li key={member.id} className="flex flex-wrap items-center gap-3 rounded-inner bg-surface-2 px-3 py-3"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text">{member.doctorName}</span><span className="text-xs text-text-soft">{member.doctorSpecialization} · {member.role} · {member.scope} · {member.status}</span></span>{member.status !== "revoked" ? <><button type="button" onClick={() => update.mutate({ id: member.id, status: member.status === "active" ? "paused" : "active" })} disabled={update.isPending} className="rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-text-soft">{member.status === "active" ? "Pause" : "Resume"}</button><button type="button" onClick={() => { if (window.confirm("Revoke this care-team connection?")) update.mutate({ id: member.id, status: "revoked" }); }} disabled={update.isPending} className="rounded-pill bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger">Revoke</button></> : null}</li>)}</ul>}</QueryBoundary></Card></div>;
}
