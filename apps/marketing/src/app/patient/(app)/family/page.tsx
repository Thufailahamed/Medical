"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api } from "@/portal/lib/api";

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  phone?: string | null;
  isLocked?: boolean;
}

export default function FamilyPage() {
  const qc = useQueryClient();
  const family = useQuery({
    queryKey: ["patient", "family"],
    queryFn: () => api<{ family: FamilyMember[] }>("/patients/me/family"),
  });
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Other");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => api("/patients/me/family", { method: "POST", json: { name, relationship, phone: phone || undefined } }),
    onSuccess: () => { setName(""); setPhone(""); qc.invalidateQueries({ queryKey: ["patient", "family"] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/patients/me/family/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", "family"] }),
  });

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try { await add.mutateAsync(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add family member."); }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader label="Family locker" title="Family" description="Manage family profiles and switch the active member from the patient header." />
      <Card>
        <form onSubmit={addMember} className="grid gap-3 sm:grid-cols-3">
          <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" />
          <input required value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Relationship" className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" />
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone (optional)" className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" />
          <button type="submit" disabled={add.isPending} className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3">{add.isPending ? "Adding…" : "Add family member"}</button>
        </form>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>
      <Card>
        <QueryBoundary query={family} loadingCount={3} emptyTitle="No family members" emptyDescription="Add a family member to build a shared health locker.">
          {(data) => <ul className="flex flex-col gap-2">{data.family.map((member) => <li key={member.id} className="flex items-center gap-3 rounded-inner bg-surface-2 px-3 py-3"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text">{member.name}</span><span className="text-xs text-text-soft">{member.relationship}{member.phone ? ` · ${member.phone}` : ""}</span></span><button type="button" onClick={() => { if (window.confirm(`Remove ${member.name}?`)) remove.mutate(member.id); }} disabled={remove.isPending} className="rounded-pill bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60">Remove</button></li>)}</ul>}
        </QueryBoundary>
      </Card>
    </div>
  );
}
