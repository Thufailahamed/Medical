"use client";

import { useState } from "react";
import { Lock, LockOpen, UserPlus } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import {
  useAddFamilyMember,
  useCreateFamilyInvite,
  useDeleteFamilyMember,
  useFamilyInvites,
  useFamilyMembers,
  useRevokeFamilyInvite,
  useToggleFamilyLock,
} from "@/patient/hooks";

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

const inputCls =
  "h-11 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text";

export default function FamilyPage() {
  const family = useFamilyMembers();
  const invites = useFamilyInvites();
  const add = useAddFamilyMember();
  const remove = useDeleteFamilyMember();
  const toggleLock = useToggleFamilyLock();
  const createInvite = useCreateFamilyInvite();
  const revokeInvite = useRevokeFamilyInvite();

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Other");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRelationship, setInviteRelationship] = useState(RELATIONSHIPS[0]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await add.mutateAsync({
        name,
        relationship,
        phone: phone || undefined,
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
      setInviteError(
        cause instanceof Error ? cause.message : "Could not create invite.",
      );
    }
  }

  function closeInvite() {
    setInviteOpen(false);
    setInviteName("");
    setInviteRelationship(RELATIONSHIPS[0]);
    setInviteUrl(null);
    setInviteError(null);
  }

  const pendingInvites = (invites.data?.invites ?? []).filter(
    (inv) => !inv.revoked && !inv.consumedAt,
  );

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Family locker"
        title="Family"
        description="Manage family profiles, privacy locks, and invites. Switch the active member from the patient header."
        action={
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Invite
          </button>
        }
      />

      <Card>
        <form onSubmit={addMember} className="grid gap-3 sm:grid-cols-3">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
            className={inputCls}
          />
          <select
            required
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            className={inputCls}
          >
            {RELATIONSHIPS.map((rel) => (
              <option key={rel} value={rel}>
                {rel}
              </option>
            ))}
          </select>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone (optional)"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={add.isPending}
            className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3"
          >
            {add.isPending ? "Adding…" : "Add family member"}
          </button>
        </form>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </Card>

      <Card>
        <QueryBoundary
          query={family}
          loadingCount={3}
          emptyTitle="No family members"
          emptyDescription="Add a family member to build a shared health locker."
        >
          {(data) => (
            <ul className="flex flex-col gap-2">
              {data.family.map((member) => {
                const locked = !!member.isLocked;
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-3 rounded-inner bg-surface-2 px-3 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="block truncate text-sm font-semibold text-text">
                          {member.name}
                        </span>
                        {locked ? <Pill tone="warn">Locked</Pill> : null}
                      </span>
                      <span className="text-xs text-text-soft">
                        {member.relationship}
                        {member.phone ? ` · ${member.phone}` : ""}
                      </span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={locked ? `Unlock ${member.name}` : `Lock ${member.name}`}
                        onClick={() => {
                          const action = locked ? "unlock" : "lock";
                          if (
                            !window.confirm(
                              locked
                                ? `Unlock ${member.name}? Their records will be visible again.`
                                : `Lock ${member.name}? Their records will be hidden until unlocked.`,
                            )
                          ) {
                            return;
                          }
                          toggleLock.mutate(
                            { id: member.id, locked: !locked },
                            {
                              onError: (cause) => {
                                setError(
                                  cause instanceof Error
                                    ? cause.message
                                    : `Could not ${action} member.`,
                                );
                              },
                            },
                          );
                        }}
                        disabled={toggleLock.isPending}
                        className="inline-flex items-center gap-1 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-60"
                      >
                        {locked ? (
                          <LockOpen className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Lock className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {locked ? "Unlock" : "Lock"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${member.name}?`)) {
                            remove.mutate(member.id);
                          }
                        }}
                        disabled={remove.isPending}
                        className="rounded-pill bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </QueryBoundary>
      </Card>

      {pendingInvites.length > 0 ? (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text">Pending invites</h2>
          <ul className="flex flex-col gap-2">
            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 rounded-inner bg-surface-2 px-3 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text">
                    {inv.label || "Family invite"}
                  </span>
                  <span className="text-xs text-text-soft">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Revoke this invite?")) {
                      revokeInvite.mutate(inv.token);
                    }
                  }}
                  disabled={revokeInvite.isPending}
                  className="rounded-pill bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {inviteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Invite family member"
        >
          <Card className="w-full max-w-md">
            <h2 className="mb-3 text-lg font-bold text-text">Invite family member</h2>
            {inviteUrl ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-text-soft">
                  Share this link. It expires in 14 days.
                </p>
                <code className="break-all rounded-inner bg-surface-2 p-3 text-xs text-text">
                  {inviteUrl}
                </code>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteUrl);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={closeInvite}
                    className="rounded-pill border border-border px-4 py-2 text-sm font-semibold text-text-soft"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={createInviteLink} className="flex flex-col gap-3">
                <input
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Their full name"
                  className={inputCls}
                />
                <select
                  value={inviteRelationship}
                  onChange={(e) => setInviteRelationship(e.target.value)}
                  className={inputCls}
                >
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
                {inviteError ? (
                  <p role="alert" className="text-sm text-danger">
                    {inviteError}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={createInvite.isPending}
                    className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {createInvite.isPending ? "Creating…" : "Create invite"}
                  </button>
                  <button
                    type="button"
                    onClick={closeInvite}
                    className="rounded-pill border border-border px-4 py-2 text-sm font-semibold text-text-soft"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
