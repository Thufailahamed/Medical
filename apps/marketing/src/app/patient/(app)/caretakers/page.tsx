"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  HeartHandshake,
  Loader2,
  Mail,
  Pause,
  Play,
  Plus,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";

interface CaretakerLink {
  linkId: string;
  caretakerName: string | null;
  careRole: string;
  status: "active" | "paused" | "revoked";
  caretakerVerified: boolean;
}

interface CaretakerInvite {
  id: string;
  caretakerName: string;
  careRole: string;
  channel: string;
  consumedAt: string | null;
  revoked: boolean;
}

const CARE_ROLES = [
  { value: "family", label: "Family Member / Relative" },
  { value: "guardian", label: "Legal Guardian" },
  { value: "nurse", label: "Home Health Nurse" },
  { value: "spouse", label: "Spouse / Partner" },
  { value: "other", label: "Trusted Helper / Other" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function CaretakersPage() {
  const qc = useQueryClient();

  const links = useQuery({
    queryKey: ["patient", "caretakers", "links"],
    queryFn: () => api<{ links: CaretakerLink[] }>("/caretaker/links"),
  });

  const invites = useQuery({
    queryKey: ["patient", "caretakers", "invites"],
    queryFn: () => api<{ invites: CaretakerInvite[] }>("/caretaker/invites"),
  });

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [channel, setChannel] = useState<"mobile" | "email">("mobile");
  const [careRole, setCareRole] = useState("family");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<{ url: string }>("/caretaker/invites", {
        method: "POST",
        json: {
          caretakerName: name.trim(),
          contact: contact.trim(),
          channel,
          careRole,
        },
      }),
    onSuccess: () => {
      setName("");
      setContact("");
      setSuccessMsg("Caretaker invitation sent successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
      qc.invalidateQueries({ queryKey: ["patient", "caretakers"] });
    },
  });

  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      api(`/caretaker/links/${id}`, {
        method: "PATCH",
        json: { status },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", "caretakers", "links"] }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/caretaker/links/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", "caretakers", "links"] }),
  });

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !contact.trim()) return;
    setError(null);
    try {
      await create.mutateAsync();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create caretaker invite.");
    }
  }

  const rawLinks = links.data?.links ?? [];
  const rawInvites = (invites.data?.invites ?? []).filter((inv) => !inv.revoked);
  const activeLinks = rawLinks.filter((l) => l.status !== "revoked");
  const activeCount = activeLinks.filter((l) => l.status === "active").length;

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
                <HeartHandshake size={12} className="text-sky-300" />
                Delegated Healthcare Access
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Caretakers &amp; Shared Access
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Authorize trusted family members, legal guardians, or home nurses to manage consultations, pharmacy orders, and records.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/family"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Users size={13} />
                <span>Family Members</span>
              </Link>
              <Link
                href="/patient/emergency-card"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <ShieldCheck size={14} className="text-sky-700" />
                <span>Emergency Card</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <UserCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active Caretakers
                </p>
                <p className="text-base font-extrabold text-white">
                  {activeCount} Authorized
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Pending Invites
                </p>
                <p className="text-base font-extrabold text-white">
                  {rawInvites.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Shield size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Access Level
                </p>
                <p className="text-base font-extrabold text-white">Granular RBAC</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Audit Trail
                </p>
                <p className="text-base font-extrabold text-white">Logged Safe</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Invite Caretaker Form Card ──────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <UserPlus size={16} className="text-sky-600" />
            <span>Invite a Trusted Caretaker</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Send an SMS or Email invitation granting verified care access to your patient profile.
          </p>
        </div>

        <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Caretaker Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Eleanor Vance"
              className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Care Role
            </label>
            <select
              value={careRole}
              onChange={(e) => setCareRole(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
            >
              {CARE_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>{channel === "email" ? "Email Address" : "Phone Number"}</span>
              <div className="flex items-center gap-1 font-semibold text-[10px] text-sky-700">
                <button
                  type="button"
                  onClick={() => setChannel(channel === "mobile" ? "email" : "mobile")}
                  className="hover:underline cursor-pointer"
                >
                  Use {channel === "mobile" ? "Email" : "SMS"}
                </button>
              </div>
            </label>
            <div className="relative">
              <input
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={channel === "email" ? "eleanor@example.com" : "+94 77 987 6543"}
                className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={create.isPending || !name.trim() || !contact.trim()}
              className="w-full h-10 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              {create.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Inviting…</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Invite Caretaker</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </section>

      {/* ── 3. Linked Caretakers List ───────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-600" />
            <span>Authorized Caretakers</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              {activeLinks.length}
            </span>
          </h2>
        </div>

        {links.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : activeLinks.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-2xs">
              <ShieldCheck size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">
                No Caretakers Currently Linked
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                You maintain full, exclusive control over your health profile. If you have an elderly parent, partner, or private nurse who helps coordinate your medical care, send them an invitation above.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeLinks.map((link) => {
              const isPaused = link.status === "paused";
              const initials = getInitials(link.caretakerName ?? "Caretaker");

              return (
                <article
                  key={link.linkId}
                  className={cn(
                    "p-4 sm:p-5 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4",
                    isPaused
                      ? "border-amber-200 bg-amber-50/20"
                      : "border-slate-200/90 hover:border-emerald-300",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                            {link.caretakerName ?? "Authorized Caretaker"}
                          </h3>
                          {link.caretakerVerified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={10} />
                              Verified
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                          <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 capitalize">
                            {link.careRole}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[11px] font-bold capitalize",
                              isPaused
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800",
                            )}
                          >
                            {link.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        patch.mutate({
                          id: link.linkId,
                          status: isPaused ? "active" : "paused",
                        })
                      }
                      disabled={patch.isPending}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50",
                        isPaused
                          ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                          : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200",
                      )}
                    >
                      {isPaused ? <Play size={13} /> : <Pause size={13} />}
                      <span>{isPaused ? "Resume Access" : "Pause Access"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Revoke delegated care access for ${link.caretakerName}?`,
                          )
                        ) {
                          revoke.mutate(link.linkId);
                        }
                      }}
                      disabled={revoke.isPending}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Revoke Access
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Pending Invitations Section ─────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <span>Pending Caretaker Invitations</span>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              {rawInvites.length}
            </span>
          </h2>
        </div>

        {invites.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : rawInvites.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                No Pending Caretaker Invitations
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                All sent caretaker invitations have been resolved or accepted.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rawInvites.map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {inv.caretakerName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 capitalize">
                    {inv.careRole} · via {inv.channel}
                  </p>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                  {inv.consumedAt ? "Accepted" : "Awaiting Verification"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Caretaker Privileges Callout ─────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Patient Control &amp; Granular Consent
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Caretakers only have delegated proxy access. You can pause or permanently revoke their permission at any time with immediate effect.
            </p>
          </div>
        </div>

        <Link
          href="/patient/emergency-card"
          className="px-4 py-2 rounded-xl text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <ExternalLink size={13} className="text-sky-700" />
          <span>Emergency Contacts</span>
        </Link>
      </section>
    </div>
  );
}
