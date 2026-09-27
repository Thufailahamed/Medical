"use client";

import { useState } from "react";
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
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

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
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<HeartHandshake size={13} aria-hidden />}
        kicker="Delegated Healthcare Access"
        title="Caretakers & Shared Access"
        description="Authorize trusted family members, legal guardians, or home nurses to manage consultations, pharmacy orders, and records."
        actions={
          <>
            <Link href="/patient/family" className={heroSecondaryAction}>
              <Users size={13} aria-hidden />
              Family Members
            </Link>
            <Link href="/patient/emergency-card" className={heroPrimaryAction}>
              <ShieldCheck size={14} aria-hidden />
              Emergency Card
            </Link>
          </>
        }
        footer={
          <>
            <span>Active Caretakers · {activeCount} Authorized</span>
            <span>Pending Invites · {rawInvites.length}</span>
            <span>Access Level · Granular RBAC</span>
            <span>Audit Trail · Logged Safe</span>
          </>
        }
      />

      {/* ── 2. Invite Caretaker Form Card ──────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
        <div>
          <h2 className="pt-kicker flex items-center gap-2">
            <UserPlus size={16} className="text-brand" aria-hidden />
            <span>Invite a Trusted Caretaker</span>
          </h2>
          <p className="text-xs text-text-soft mt-0.5">
            Send an SMS or Email invitation granting verified care access to your patient profile.
          </p>
        </div>

        <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
              Caretaker Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Eleanor Vance"
              className="pt-input text-xs sm:text-sm"
            />
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
              Care Role
            </label>
            <select
              value={careRole}
              onChange={(e) => setCareRole(e.target.value)}
              className="pt-input text-xs sm:text-sm"
            >
              {CARE_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider flex items-center justify-between">
              <span>{channel === "email" ? "Email Address" : "Phone Number"}</span>
              <div className="flex items-center gap-1 font-semibold text-[10px] text-brand">
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
                className="pt-input text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={create.isPending || !name.trim() || !contact.trim()}
              className="pt-btn pt-btn-primary h-11 w-full text-xs disabled:opacity-50"
            >
              {create.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                  Inviting…
                </>
              ) : (
                <>
                  <Plus size={14} aria-hidden />
                  Invite Caretaker
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-success-soft border border-success/25 text-xs font-semibold text-success flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" aria-hidden />
            <span>{successMsg}</span>
          </div>
        )}
      </section>

      {/* ── 3. Linked Caretakers List ───────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="pt-kicker flex items-center gap-2">
            <UserCheck size={16} className="text-success" aria-hidden />
            <span>Authorized Caretakers</span>
            <span className="rounded-md bg-success-soft px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-success">
              {activeLinks.length}
            </span>
          </h2>
        </div>

        {links.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : activeLinks.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-xl bg-surface border border-border shadow-card flex flex-col items-center text-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-success-soft text-success shadow-2xs" aria-hidden>
              <ShieldCheck size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="t-card-title text-text">
                No Caretakers Currently Linked
              </h3>
              <p className="text-xs sm:text-sm text-text-soft mt-1 leading-relaxed">
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
                    "p-4 sm:p-5 rounded-xl bg-surface border shadow-card hover:shadow-md transition-all flex flex-col justify-between gap-4",
                    isPaused
                      ? "border-warn/40 bg-warn-soft/20"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="grid h-12 w-12 place-items-center rounded-md bg-success-soft text-success font-mono font-bold text-sm shrink-0 shadow-2xs" aria-hidden>
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-text text-sm sm:text-base truncate">
                            {link.caretakerName ?? "Authorized Caretaker"}
                          </h3>
                          {link.caretakerVerified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-success-soft text-success">
                              <CheckCircle2 size={10} aria-hidden />
                              Verified
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-soft font-medium">
                          <span className="text-success font-semibold bg-success-soft px-2 py-0.5 rounded-md capitalize">
                            {link.careRole}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize",
                              isPaused
                                ? "bg-warn-soft text-warn"
                                : "bg-success-soft text-success",
                            )}
                          >
                            {link.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
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
                        "pt-btn h-8 px-3 text-xs disabled:opacity-50",
                        isPaused
                          ? "bg-success-soft text-success hover:brightness-95"
                          : "bg-warn-soft text-warn hover:brightness-95",
                      )}
                    >
                      {isPaused ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
                      {isPaused ? "Resume Access" : "Pause Access"}
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
                      className="pt-btn h-8 px-3 text-xs text-danger hover:bg-danger-soft disabled:opacity-50"
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
          <h2 className="pt-kicker flex items-center gap-2">
            <Clock size={16} className="text-warn" aria-hidden />
            <span>Pending Caretaker Invitations</span>
            <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-warn">
              {rawInvites.length}
            </span>
          </h2>
        </div>

        {invites.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : rawInvites.length === 0 ? (
          <div className="p-6 rounded-xl bg-surface border border-border shadow-card flex items-center gap-3.5">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-surface-2 text-text-muted shrink-0" aria-hidden>
              <Mail size={18} />
            </div>
            <div>
              <h3 className="t-card-title text-text">
                No Pending Caretaker Invitations
              </h3>
              <p className="text-xs text-text-soft mt-0.5">
                All sent caretaker invitations have been resolved or accepted.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rawInvites.map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-xl bg-surface border border-border shadow-card flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-text truncate">
                    {inv.caretakerName}
                  </p>
                  <p className="text-[11px] text-text-soft mt-0.5 capitalize">
                    {inv.careRole} · via {inv.channel}
                  </p>
                </div>

                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-warn-soft text-warn shrink-0">
                  {inv.consumedAt ? "Accepted" : "Awaiting Verification"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Caretaker Privileges Callout ─────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-soft text-brand shrink-0" aria-hidden>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              Patient Control &amp; Granular Consent
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              Caretakers only have delegated proxy access. You can pause or permanently revoke their permission at any time with immediate effect.
            </p>
          </div>
        </div>

        <Link
          href="/patient/emergency-card"
          className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
        >
          <ExternalLink size={13} aria-hidden />
          Emergency Contacts
        </Link>
      </section>
    </div>
  );
}
