"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api } from "@/portal/lib/api";

interface CaretakerLink { linkId: string; caretakerName: string | null; careRole: string; status: "active" | "paused" | "revoked"; caretakerVerified: boolean; }
interface CaretakerInvite { id: string; caretakerName: string; careRole: string; channel: string; consumedAt: string | null; revoked: boolean; }

export default function CaretakersPage() {
  const qc = useQueryClient();
  const links = useQuery({ queryKey: ["patient", "caretakers", "links"], queryFn: () => api<{ links: CaretakerLink[] }>("/caretaker/links") });
  const invites = useQuery({ queryKey: ["patient", "caretakers", "invites"], queryFn: () => api<{ invites: CaretakerInvite[] }>("/caretaker/invites") });
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [channel, setChannel] = useState<"mobile" | "email">("mobile");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({ mutationFn: () => api<{ url: string }>("/caretaker/invites", { method: "POST", json: { caretakerName: name, contact, channel, careRole: "other" } }), onSuccess: () => { setName(""); setContact(""); qc.invalidateQueries({ queryKey: ["patient", "caretakers"] }); } });
  const patch = useMutation({ mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) => api(`/caretaker/links/${id}`, { method: "PATCH", json: { status } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", "caretakers", "links"] }) });
  const revoke = useMutation({ mutationFn: (id: string) => api(`/caretaker/links/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", "caretakers", "links"] }) });

  async function invite(event: React.FormEvent) { event.preventDefault(); setError(null); try { await create.mutateAsync(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create caretaker invite."); } }

  return <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2"><SectionHeader label="Delegated care" title="Caretakers" description="Invite trusted people to help manage a patient profile." /><Card><form onSubmit={invite} className="grid gap-3 sm:grid-cols-3"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Caretaker name" className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" /><input required value={contact} onChange={(event) => setContact(event.target.value)} placeholder={channel === "email" ? "Email" : "Phone"} className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" /><select value={channel} onChange={(event) => setChannel(event.target.value as "mobile" | "email")} className="h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text"><option value="mobile">SMS</option><option value="email">Email</option></select><button type="submit" disabled={create.isPending} className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3">{create.isPending ? "Inviting…" : "Invite caretaker"}</button></form>{error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}</Card><Card><h2 className="text-sm font-bold text-text">Linked caretakers</h2><QueryBoundary query={links} loadingCount={3} emptyTitle="No caretakers linked" emptyDescription="Invitations and accepted links will appear here." className="mt-3">{(data) => <ul className="flex flex-col gap-2">{data.links.map((link) => <li key={link.linkId} className="flex flex-wrap items-center gap-2 rounded-inner bg-surface-2 px-3 py-3"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text">{link.caretakerName ?? "Caretaker"}</span><span className="text-xs text-text-soft">{link.careRole} · {link.status}{link.caretakerVerified ? " · verified" : ""}</span></span>{link.status !== "revoked" ? <><button type="button" onClick={() => patch.mutate({ id: link.linkId, status: link.status === "paused" ? "active" : "paused" })} className="rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-text-soft">{link.status === "paused" ? "Resume" : "Pause"}</button><button type="button" onClick={() => { if (window.confirm("Revoke this caretaker link?")) revoke.mutate(link.linkId); }} className="rounded-pill bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger">Revoke</button></> : null}</li>)}</ul>}</QueryBoundary></Card><Card><h2 className="text-sm font-bold text-text">Pending invites</h2><QueryBoundary query={invites} loadingCount={2} emptyTitle="No pending invites" emptyDescription="New caretaker invitations will appear here." className="mt-3">{(data) => <ul className="flex flex-col gap-2">{data.invites.filter((invite) => !invite.revoked).map((invite) => <li key={invite.id} className="rounded-inner bg-surface-2 px-3 py-3 text-sm text-text">{invite.caretakerName} · {invite.channel} · {invite.consumedAt ? "Accepted" : "Pending"}</li>)}</ul>}</QueryBoundary></Card></div>;
}
