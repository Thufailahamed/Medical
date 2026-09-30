"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Link as LinkIcon,
  Loader2,
  Lock,
  LockOpen,
  Phone,
  Plus,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  useAddFamilyMember,
  useCreateFamilyInvite,
  useDeleteFamilyMember,
  useFamilyInvites,
  useFamilyMembers,
  useRevokeFamilyInvite,
  useToggleFamilyLock,
} from "@/patient/hooks";
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
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  StatTile,
  EmptyBlock,
} from "@/patient/components/workspace";

const RELATIONSHIPS = [
  "Spouse",
  "Father",
  "Mother",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandfather",
  "Grandmother",
  "Uncle",
  "Aunt",
  "Cousin",
  "Other",
];

function getMemberInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function FamilyPage() {
  const family = useFamilyMembers();
  const invites = useFamilyInvites();
  const add = useAddFamilyMember();
  const remove = useDeleteFamilyMember();
  const toggleLock = useToggleFamilyLock();
  const createInvite = useCreateFamilyInvite();
  const revokeInvite = useRevokeFamilyInvite();

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Spouse");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRelationship, setInviteRelationship] = useState(RELATIONSHIPS[0]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const familyList = useMemo(() => family.data?.family ?? [], [family.data?.family]);
  const pendingInvites = useMemo(
    () => (invites.data?.invites ?? []).filter((inv) => !inv.revoked && !inv.consumedAt),
    [invites.data?.invites],
  );

  const lockedCount = useMemo(
    () => familyList.filter((m) => Boolean(m.isLocked)).length,
    [familyList],
  );

  const filteredFamily = useMemo(() => {
    let list = familyList;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.relationship || "").toLowerCase().includes(q) ||
          (m.phone || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [familyList, search]);

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await add.mutateAsync({
        name: name.trim(),
        relationship,
        phone: phone.trim() || undefined,
      });
      setName("");
      setPhone("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add family member.");
    }
  }

  async function createInviteLink(event: React.FormEvent) {
    event.preventDefault();
    setInviteError(null);
    try {
      const res = await createInvite.mutateAsync({
        name: inviteName.trim(),
        relationship: inviteRelationship,
        expiresInHours: 24 * 14,
      });
      const url =
        res.url ||
        `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${res.token}`;
      setInviteUrl(url);
    } catch (cause) {
      setInviteError(cause instanceof Error ? cause.message : "Could not create invite.");
    }
  }

  function closeInvite() {
    setInviteOpen(false);
    setInviteName("");
    setInviteRelationship(RELATIONSHIPS[0]);
    setInviteUrl(null);
    setInviteCopied(false);
    setInviteError(null);
  }

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<Users size={13} aria-hidden />}
        kicker="Family & Safety"
        kickerMeta="Household health locker"
        title={
          <>
            Family <HeroAccent>health profiles</HeroAccent>
          </>
        }
        description="Manage dependents, elderly parents, and spouses. Lock individual records for privacy or invite relatives to claim their own profile."
        chips={
          <>
            <span className={HERO_CHIP}>
              <Users size={12} className="text-sky-300" />
              {familyList.length} member{familyList.length === 1 ? "" : "s"}
            </span>
            {pendingInvites.length > 0 ? (
              <span className={HERO_DANGER_CHIP}>
                <Clock3 size={12} />
                {pendingInvites.length} pending invite{pendingInvites.length === 1 ? "" : "s"}
              </span>
            ) : null}
            {lockedCount > 0 ? (
              <span className={HERO_CHIP}>
                <Lock size={12} className="text-amber-300" />
                {lockedCount} locked
              </span>
            ) : null}
            <span className={HERO_CHIP}>Encrypted per member</span>
          </>
        }
        actions={
          <>
            <Link href="/patient/caretakers" className={HERO_GHOST}>
              <ShieldCheck size={13} /> Caretakers
            </Link>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className={HERO_PRIMARY}
            >
              <UserPlus size={14} /> Invite member
            </button>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Users size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Members"
          value={String(familyList.length)}
          sub="Linked profiles"
        />
        <StatTile
          icon={<LinkIcon size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Pending invites"
          value={String(pendingInvites.length)}
          sub={pendingInvites.length > 0 ? "Awaiting acceptance" : "None outstanding"}
          pulse={pendingInvites.length > 0}
        />
        <StatTile
          icon={<Lock size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Privacy locks"
          value={String(lockedCount)}
          sub={lockedCount > 0 ? "Records secured" : "All records visible"}
        />
        <StatTile
          icon={<ShieldAlert size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Emergency card"
          value="Ready"
          sub="SOS + medical ID"
          href="/patient/emergency"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<UserPlus size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Add dependent or family profile"
              caption="Instantly create a managed health profile for a child, parent, or spouse under your account."
            />
            <div className="p-4 sm:p-5">
              <form onSubmit={addMember} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="flex flex-col gap-1.5 sm:col-span-4">
                  <label className={FIELD_LABEL}>Full name</label>
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className={FIELD_INPUT}
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label className={FIELD_LABEL}>Relationship</label>
                  <select
                    required
                    value={relationship}
                    onChange={(event) => setRelationship(event.target.value)}
                    className={FIELD_INPUT}
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label className={FIELD_LABEL}>Phone (optional)</label>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+94 77 123 4567"
                    className={FIELD_INPUT}
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <button
                    type="submit"
                    disabled={add.isPending || !name.trim()}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {add.isPending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    {add.isPending ? "Adding…" : "Add"}
                  </button>
                </div>
              </form>
              {error ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              ) : null}
            </div>
          </section>

          <section className={PANEL}>
            <PanelHeader
              icon={<Users size={16} />}
              tone="bg-sky-50 text-sky-600"
              title={`Family members (${familyList.length})`}
              caption="Switch, lock, or remove a managed profile at any time."
              action={
                <PanelSearch
                  value={search}
                  onChange={setSearch}
                  placeholder="Search name, relationship, phone"
                  ariaLabel="Search family members"
                />
              }
            />
            {family.isLoading ? (
              <PanelSkeleton rows={3} />
            ) : filteredFamily.length === 0 ? (
              <EmptyBlock
                icon={<Users size={19} />}
                title={search ? "No members match your search" : "No family members yet"}
                body={
                  search
                    ? `No profiles found for "${search}". Clear the search to see everyone.`
                    : "Add children, a spouse, or parents above to manage their appointments, prescriptions, and records in one place."
                }
              />
            ) : (
              <div className="grid gap-3 p-3.5 sm:grid-cols-2">
                {filteredFamily.map((member) => {
                  const locked = Boolean(member.isLocked);
                  return (
                    <article
                      key={member.id}
                      className={cn(
                        "flex flex-col justify-between gap-4 rounded-2xl border p-4 transition-all",
                        locked
                          ? "border-amber-200 bg-amber-50/40"
                          : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "grid h-11 w-11 shrink-0 place-items-center rounded-xl font-bold text-sm",
                            locked
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-900 text-sky-300",
                          )}
                        >
                          {getMemberInitials(member.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-slate-900">
                              {member.name}
                            </h3>
                            {locked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                <Lock size={10} /> Locked
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                            <span className="rounded-md bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                              {member.relationship}
                            </span>
                            {member.phone ? (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Phone size={11} /> {member.phone}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !window.confirm(
                                locked
                                  ? `Unlock ${member.name}? Their medical records will become visible in the locker.`
                                  : `Lock ${member.name}? Their medical records will be secured until unlocked.`,
                              )
                            ) {
                              return;
                            }
                            toggleLock.mutate({ id: member.id, locked: !locked });
                          }}
                          disabled={toggleLock.isPending}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50",
                            locked
                              ? "bg-amber-100 text-amber-700 hover:bg-amber-200/70"
                              : "bg-slate-100 text-slate-600 hover:text-slate-900",
                          )}
                        >
                          {locked ? <LockOpen size={13} /> : <Lock size={13} />}
                          {locked ? "Unlock records" : "Privacy lock"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove ${member.name} from your family locker?`)) {
                              remove.mutate(member.id);
                            }
                          }}
                          disabled={remove.isPending}
                          className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          Remove
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
            id="family-tools"
            title="Family & Safety"
            tools={[
              {
                icon: ShieldCheck,
                label: "Caretakers",
                hint: "Delegate access",
                href: "/patient/caretakers",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
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
              title={`Pending invites (${pendingInvites.length})`}
              caption="Links expire 14 days after issue."
            />
            {pendingInvites.length === 0 ? (
              <EmptyBlock
                icon={<LinkIcon size={19} />}
                title="No active invite links"
                body="Generate an invitation to let a relative claim their profile."
              />
            ) : (
              <div className="flex flex-col gap-2.5 p-3.5">
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {inv.label || "Family access invite"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Revoke this invite link?")) {
                          revokeInvite.mutate(inv.token);
                        }
                      }}
                      disabled={revokeInvite.isPending}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <PromoCard
            icon={<ShieldAlert size={21} aria-hidden />}
            kicker="Emergency"
            title="One-tap SOS for the whole family"
            body="Your emergency card shares blood group, allergies, and ICE contacts with first responders — no passcode needed."
            href="/patient/emergency"
          />
        </div>
      </div>

      {inviteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Invite family member"
        >
          <div className="relative flex w-full max-w-md flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Invite family member</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Generate a secure invitation link for your family member.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeInvite}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {inviteUrl ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Invite link generated! Share this link with your family member. It
                    expires in 14 days.
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={FIELD_LABEL}>Invitation URL</label>
                  <code className="break-all rounded-xl border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-700 select-all">
                    {inviteUrl}
                  </code>
                </div>

                <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteUrl);
                        setInviteCopied(true);
                        setTimeout(() => setInviteCopied(false), 2500);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300"
                  >
                    {inviteCopied ? (
                      <>
                        <Check size={13} className="text-emerald-600" /> Link copied!
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copy link
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeInvite}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-500"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={createInviteLink} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={FIELD_LABEL}>Their full name</label>
                  <input
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Johnathan Connor"
                    className={FIELD_INPUT}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={FIELD_LABEL}>Relationship</label>
                  <select
                    value={inviteRelationship}
                    onChange={(e) => setInviteRelationship(e.target.value)}
                    className={FIELD_INPUT}
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>

                {inviteError ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                    <AlertCircle size={14} className="shrink-0" />
                    {inviteError}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={closeInvite}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createInvite.isPending || !inviteName.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {createInvite.isPending ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Creating link…
                      </>
                    ) : (
                      <>
                        <LinkIcon size={13} /> Generate invite link
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </PatientPage>
  );
}
