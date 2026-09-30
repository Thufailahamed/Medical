"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Loader2,
  Mail,
  Pause,
  Play,
  Plus,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_CHIP,
  HERO_DANGER_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  StatTile,
  EmptyBlock,
} from "@/patient/components/workspace";

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
  const pausedCount = activeLinks.filter((l) => l.status === "paused").length;

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<HeartHandshake size={13} aria-hidden />}
        kicker="Family & Safety"
        kickerMeta="Delegated care access"
        title={
          <>
            Caretakers &amp; <HeroAccent>shared access</HeroAccent>
          </>
        }
        description="Authorize trusted family members, legal guardians, or home nurses to manage consultations, pharmacy orders, and records on your behalf."
        chips={
          <>
            <span className={HERO_CHIP}>
              <UserCheck size={12} className="text-emerald-300" />
              {activeCount} authorized
            </span>
            {pausedCount > 0 ? (
              <span className={HERO_CHIP}>
                <Pause size={12} className="text-amber-300" />
                {pausedCount} paused
              </span>
            ) : null}
            {rawInvites.length > 0 ? (
              <span className={HERO_DANGER_CHIP}>
                <Clock3 size={12} />
                {rawInvites.length} pending invite{rawInvites.length === 1 ? "" : "s"}
              </span>
            ) : null}
            <span className={HERO_CHIP}>Granular RBAC · audit logged</span>
          </>
        }
        actions={
          <>
            <Link href="/patient/family" className={HERO_GHOST}>
              <Users size={13} /> Family members
            </Link>
            <Link href="/patient/emergency" className={HERO_PRIMARY}>
              <ShieldCheck size={14} className="text-sky-600" /> Emergency card
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<UserCheck size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Active caretakers"
          value={String(activeCount)}
          sub="Full delegated access"
        />
        <StatTile
          icon={<Pause size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Paused"
          value={String(pausedCount)}
          sub="Access suspended"
        />
        <StatTile
          icon={<Mail size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Pending invites"
          value={String(rawInvites.length)}
          sub={rawInvites.length > 0 ? "Awaiting verification" : "None outstanding"}
          pulse={rawInvites.length > 0}
        />
        <StatTile
          icon={<Users size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Family members"
          value="Manage"
          sub="Household profiles"
          href="/patient/family"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<UserPlus size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Invite a trusted caretaker"
              caption="Send an SMS or email invitation granting verified care access to your profile."
            />
            <div className="mt-5">
              <form onSubmit={handleInvite} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="flex flex-col gap-1.5 sm:col-span-4">
                  <label className={FIELD_LABEL}>Caretaker name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Eleanor Vance"
                    className={FIELD_INPUT}
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label className={FIELD_LABEL}>Care role</label>
                  <select
                    value={careRole}
                    onChange={(e) => setCareRole(e.target.value)}
                    className={FIELD_INPUT}
                  >
                    {CARE_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label className={cn(FIELD_LABEL, "flex items-center justify-between")}>
                    <span>{channel === "email" ? "Email address" : "Phone number"}</span>
                    <button
                      type="button"
                      onClick={() => setChannel(channel === "mobile" ? "email" : "mobile")}
                      className="cursor-pointer text-[10px] font-semibold text-sky-600 hover:underline"
                    >
                      Use {channel === "mobile" ? "email" : "SMS"}
                    </button>
                  </label>
                  <input
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={channel === "email" ? "eleanor@example.com" : "+94 77 987 6543"}
                    className={FIELD_INPUT}
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <button
                    type="submit"
                    disabled={create.isPending || !name.trim() || !contact.trim()}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {create.isPending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    {create.isPending ? "Inviting…" : "Invite"}
                  </button>
                </div>
              </form>

              {error ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              ) : null}
              {successMsg ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 size={14} className="shrink-0" />
                  {successMsg}
                </div>
              ) : null}
            </div>
          </section>

          <section className={PANEL}>
            <PanelHeader
              icon={<UserCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={`Authorized caretakers (${activeLinks.length})`}
              caption="Pause or revoke delegated access at any time — changes apply instantly."
            />
            {links.isLoading ? (
              <PanelSkeleton rows={3} />
            ) : activeLinks.length === 0 ? (
              <EmptyBlock
                icon={<ShieldCheck size={19} />}
                title="No caretakers currently linked"
                body="You keep full, exclusive control over your health profile. Invite a family member, partner, or home nurse above to delegate care."
              />
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {activeLinks.map((link) => {
                  const isPaused = link.status === "paused";
                  return (
                    <article
                      key={link.linkId}
                      className={cn(
                        "flex flex-col justify-between gap-4 rounded-2xl border p-4 transition-all",
                        isPaused
                          ? "border-amber-200 bg-amber-50/40"
                          : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "grid h-11 w-11 shrink-0 place-items-center rounded-xl font-bold text-sm",
                            isPaused
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-50 text-emerald-600",
                          )}
                        >
                          {getInitials(link.caretakerName ?? "Caretaker")}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-slate-900">
                              {link.caretakerName ?? "Authorized caretaker"}
                            </h3>
                            {link.caretakerVerified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                <CheckCircle2 size={10} /> Verified
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold capitalize text-emerald-700">
                              {link.careRole}
                            </span>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                                isPaused
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700",
                              )}
                            >
                              {link.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
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
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50",
                            isPaused
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200/70"
                              : "bg-amber-100 text-amber-700 hover:bg-amber-200/70",
                          )}
                        >
                          {isPaused ? <Play size={13} /> : <Pause size={13} />}
                          {isPaused ? "Resume access" : "Pause access"}
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
                          className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          Revoke access
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="ct-tools"
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
                icon: ShieldAlert,
                label: "Emergency",
                hint: "SOS + med ID",
                href: "/patient/emergency",
                tone: "from-rose-500 to-red-600 shadow-rose-500/30",
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

          <section className={PANEL}>
            <PanelHeader
              icon={<Clock3 size={16} />}
              tone="bg-amber-50 text-amber-600"
              title={`Pending invitations (${rawInvites.length})`}
              caption="Sent invites awaiting caretaker verification."
            />
            {invites.isLoading ? (
              <PanelSkeleton rows={1} />
            ) : rawInvites.length === 0 ? (
              <EmptyBlock
                icon={<Mail size={19} />}
                title="No pending invitations"
                body="All sent caretaker invitations have been resolved or accepted."
              />
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {rawInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{inv.caretakerName}</p>
                      <p className="mt-0.5 text-[11px] capitalize text-slate-500">
                        {inv.careRole} · via {inv.channel}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      {inv.consumedAt ? "Accepted" : "Awaiting"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <PromoCard
            icon={<ShieldCheck size={21} aria-hidden />}
            kicker="Your control"
            title="Granular consent, always"
            body="Caretakers only get delegated proxy access — pause or revoke any time with immediate effect."
            href="/patient/emergency"
          />
        </div>
      </div>
    </PatientPage>
  );
}
