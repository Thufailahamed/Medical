"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Link as LinkIcon,
  Loader2,
  Lock,
  LockOpen,
  Phone,
  Plus,
  Search,
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
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

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

  const familyList = family.data?.family ?? [];
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
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<Users size={13} aria-hidden />}
        kicker="Household Health Locker"
        title="Family Health Profiles & Access"
        description="Manage dependents, elderly parents, and spouses. Switch active patient view anytime or lock records for privacy."
        actions={
          <>
            <Link href="/patient/caretakers" className={heroSecondaryAction}>
              <ShieldCheck size={13} aria-hidden />
              Caretakers
            </Link>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className={heroPrimaryAction}
            >
              <UserPlus size={14} aria-hidden />
              Invite Family Member
            </button>
          </>
        }
        footer={
          <>
            <span>Family Members · {familyList.length} Linked</span>
            <span>Pending Invites · {pendingInvites.length}</span>
            <span>Privacy Locks · {lockedCount} Locked</span>
            <span>Data Isolation · Encrypted</span>
          </>
        }
      />

      {/* ── 2. Add Family Member Form Card ─────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
        <div>
          <h2 className="pt-kicker flex items-center gap-2">
            <UserPlus size={16} className="text-brand" aria-hidden />
            <span>Add Dependent or Family Profile</span>
          </h2>
          <p className="text-xs text-text-soft mt-0.5">
            Instantly create a managed health profile for a child, parent, or spouse under your account.
          </p>
        </div>

        <form onSubmit={addMember} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
              Full Name
            </label>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Sarah Connor"
              className="pt-input text-xs sm:text-sm"
            />
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
              Relationship
            </label>
            <select
              required
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
              className="pt-input text-xs sm:text-sm"
            >
              {RELATIONSHIPS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
              Phone Number (Optional)
            </label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+94 77 123 4567"
              className="pt-input text-xs sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={add.isPending || !name.trim()}
              className="pt-btn pt-btn-primary h-11 w-full text-xs disabled:opacity-50"
            >
              {add.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                  Adding…
                </>
              ) : (
                <>
                  <Plus size={14} aria-hidden />
                  Add Member
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
      </section>

      {/* ── 3. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-xl border border-border shadow-card">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text">
            Linked Family Members ({familyList.length})
          </span>
          {lockedCount > 0 ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-warn-soft text-warn">
              {lockedCount} Locked
            </span>
          ) : null}
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, relationship, or phone..."
            className="pt-input pl-9 pr-8 !h-9 text-xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 4. Family Members Feed or Zero-State ────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {family.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredFamily.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-xl bg-surface border border-border shadow-card flex flex-col items-center text-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-soft text-brand shadow-2xs" aria-hidden>
              <Users size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="t-card-title text-text">
                {search ? "No family members match your search" : "No Family Members Added Yet"}
              </h3>
              <p className="text-xs sm:text-sm text-text-soft mt-1 leading-relaxed">
                {search
                  ? `No profiles found for "${search}". Clear search to see all members.`
                  : "Add your children, spouse, or parents above to manage appointments, prescriptions, vaccinations, and health records in one consolidated dashboard."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFamily.map((member) => {
              const locked = Boolean(member.isLocked);
              const initials = getMemberInitials(member.name);

              return (
                <article
                  key={member.id}
                  className={cn(
                    "p-4 sm:p-5 rounded-xl bg-surface border shadow-card hover:shadow-md transition-all flex flex-col justify-between gap-4",
                    locked
                      ? "border-warn/40 bg-warn-soft/20"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Avatar */}
                      <div className="grid h-12 w-12 place-items-center rounded-md bg-ink text-brand-soft font-mono font-bold text-sm shrink-0 shadow-2xs" aria-hidden>
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-text text-sm sm:text-base truncate">
                            {member.name}
                          </h3>
                          {locked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-warn-soft text-warn">
                              <Lock size={10} aria-hidden />
                              Locked
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-soft font-medium">
                          <span className="text-brand font-semibold bg-brand-soft px-2 py-0.5 rounded-md">
                            {member.relationship}
                          </span>
                          {member.phone ? (
                            <span className="flex items-center gap-1 text-text-muted">
                              <Phone size={11} aria-hidden />
                              {member.phone}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const action = locked ? "unlock" : "lock";
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
                        "pt-btn h-8 px-3 text-xs disabled:opacity-50",
                        locked
                          ? "bg-warn-soft text-warn hover:brightness-95"
                          : "bg-surface-2 text-text-soft hover:text-text",
                      )}
                    >
                      {locked ? <LockOpen size={13} aria-hidden /> : <Lock size={13} aria-hidden />}
                      {locked ? "Unlock Records" : "Privacy Lock"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove ${member.name} from your family locker?`)) {
                          remove.mutate(member.id);
                        }
                      }}
                      disabled={remove.isPending}
                      className="pt-btn h-8 px-3 text-xs text-danger hover:bg-danger-soft disabled:opacity-50"
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

      {/* ── 5. Pending Invites Section ─────────────────────────────────────── */}
      {pendingInvites.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="pt-kicker flex items-center gap-2">
              <Clock size={14} className="text-warn" aria-hidden />
              <span>Pending Family Invitations</span>
            </h3>
            <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warn">
              {pendingInvites.length} Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-lg bg-surface-2 border border-border flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-text truncate">
                    {inv.label || "Family Access Invite"}
                  </p>
                  <p className="text-[11px] text-text-soft mt-0.5">
                    Expires: {new Date(inv.expiresAt).toLocaleDateString()}
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
                  className="pt-btn h-7 px-2.5 text-xs text-danger hover:bg-danger-soft shrink-0 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── 6. Invite Family Member Modal Dialog ───────────────────────────── */}
      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 transition-opacity"
          role="dialog"
          aria-modal="true"
          aria-label="Invite family member"
        >
          <div className="relative w-full max-w-md rounded-xl bg-surface p-6 shadow-2xl border border-border flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-soft text-brand shrink-0 shadow-2xs" aria-hidden>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="t-card-title text-text">
                    Invite Family Member
                  </h2>
                  <p className="text-xs text-text-soft mt-0.5">
                    Generate a secure invitation link for your family member.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeInvite}
                aria-label="Close"
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {inviteUrl ? (
              <div className="flex flex-col gap-4">
                <div className="p-3.5 rounded-lg bg-success-soft border border-success/25 text-xs text-success flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" aria-hidden />
                  <span>
                    Invite link generated! Share this link with your family member. It expires in 14 days.
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
                    Invitation URL
                  </label>
                  <code className="break-all rounded-lg bg-surface-2 border border-border p-3 text-xs text-text font-mono select-all">
                    {inviteUrl}
                  </code>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
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
                    className="pt-btn pt-btn-secondary h-9 px-4 text-xs"
                  >
                    {inviteCopied ? (
                      <>
                        <Check size={13} className="text-success" aria-hidden />
                        Link Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={13} aria-hidden />
                        Copy Link
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={closeInvite}
                    className="pt-btn pt-btn-primary h-9 px-4 text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={createInviteLink} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-soft">
                    Their Full Name
                  </label>
                  <input
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Johnathan Connor"
                    className="pt-input text-xs sm:text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-soft">
                    Relationship
                  </label>
                  <select
                    value={inviteRelationship}
                    onChange={(e) => setInviteRelationship(e.target.value)}
                    className="pt-input text-xs sm:text-sm"
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>

                {inviteError && (
                  <div className="p-3 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" aria-hidden />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={closeInvite}
                    className="pt-btn pt-btn-ghost h-9 px-4 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createInvite.isPending || !inviteName.trim()}
                    className="pt-btn pt-btn-primary h-9 px-5 text-xs disabled:opacity-50"
                  >
                    {createInvite.isPending ? (
                      <>
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                        Creating Link…
                      </>
                    ) : (
                      <>
                        <LinkIcon size={13} aria-hidden />
                        Generate Invite Link
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
