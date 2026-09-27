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
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <UserPlus size={16} className="text-sky-600" />
            <span>Add Dependent or Family Profile</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Instantly create a managed health profile for a child, parent, or spouse under your account.
          </p>
        </div>

        <form onSubmit={addMember} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Full Name
            </label>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Sarah Connor"
              className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Relationship
            </label>
            <select
              required
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
            >
              {RELATIONSHIPS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Phone Number (Optional)
            </label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+94 77 123 4567"
              className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={add.isPending || !name.trim()}
              className="w-full h-10 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              {add.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Adding…</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Add Member</span>
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
      </section>

      {/* ── 3. Filter & Live Search Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900">
            Linked Family Members ({familyList.length})
          </span>
          {lockedCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
              {lockedCount} Locked
            </span>
          ) : null}
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, relationship, or phone..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredFamily.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-2xs">
              <Users size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">
                {search ? "No family members match your search" : "No Family Members Added Yet"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
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
                    "p-4 sm:p-5 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4",
                    locked
                      ? "border-amber-200 bg-amber-50/20"
                      : "border-slate-200/90 hover:border-sky-300",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Avatar */}
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                            {member.name}
                          </h3>
                          {locked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Lock size={10} />
                              Locked
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                          <span className="text-sky-800 font-semibold bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60">
                            {member.relationship}
                          </span>
                          {member.phone ? (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Phone size={11} />
                              {member.phone}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
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
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50",
                        locked
                          ? "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                      )}
                    >
                      {locked ? <LockOpen size={13} /> : <Lock size={13} />}
                      <span>{locked ? "Unlock Records" : "Privacy Lock"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove ${member.name} from your family locker?`)) {
                          remove.mutate(member.id);
                        }
                      }}
                      disabled={remove.isPending}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
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
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Clock size={14} className="text-amber-600" />
              <span>Pending Family Invitations</span>
            </h3>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              {pendingInvites.length} Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {inv.label || "Family Access Invite"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
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
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
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
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100 shadow-2xs">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Invite Family Member
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate a secure invitation link for your family member.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeInvite}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {inviteUrl ? (
              <div className="flex flex-col gap-4">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Invite link generated! Share this link with your family member. It expires in 14 days.
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Invitation URL
                  </label>
                  <code className="break-all rounded-xl bg-slate-100 border border-slate-200 p-3 text-xs text-slate-800 font-mono select-all">
                    {inviteUrl}
                  </code>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
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
                    className="px-4 py-2 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {inviteCopied ? (
                      <>
                        <Check size={13} className="text-emerald-600" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={closeInvite}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all cursor-pointer"
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={createInviteLink} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Their Full Name
                  </label>
                  <input
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Johnathan Connor"
                    className="w-full h-10 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Relationship
                  </label>
                  <select
                    value={inviteRelationship}
                    onChange={(e) => setInviteRelationship(e.target.value)}
                    className="w-full h-10 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>

                {inviteError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeInvite}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createInvite.isPending || !inviteName.trim()}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    }}
                  >
                    {createInvite.isPending ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Creating Link…</span>
                      </>
                    ) : (
                      <>
                        <LinkIcon size={13} />
                        <span>Generate Invite Link</span>
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
