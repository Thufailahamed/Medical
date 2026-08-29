"use client";

// Phase 2.3: side-sheet picker for switching the active family member.
//
// Mirrors apps/mobile/src/components/FamilyPickerSheet.tsx on the web
// primitives. Renders a "Self (you)" row plus one row per family
// member owned by the current user. Selecting a row calls
// `useSetActiveFamilyMember()` which optimistically updates the
// persisted store, PATCHes the server column, and invalidates every
// `["patient"]` query so list pages re-scope.

import { UserMinus, Users } from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import {
  useFamilyMembers,
  useSetActiveFamilyMember,
} from "@/patient/hooks/useActiveFamilyMember";
import { useActiveFamilyMemberStore } from "@/patient/stores/activeFamilyMember";
import { cn } from "@/portal/lib/utils";

export function FamilyMemberPickerSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const activeId = useActiveFamilyMemberStore((s) => s.activeFamilyMemberId);
  const { data, isLoading } = useFamilyMembers();
  const setActive = useSetActiveFamilyMember();
  const members = data?.family ?? [];

  async function pick(memberId: string | null) {
    onClose();
    await setActive.mutateAsync(memberId);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      ariaLabel="Switch active family member"
    >
      <h2 className="t-card-title">Viewing records for</h2>
      <p className="t-micro">
        Records, medicines, vitals and other lists will re-scope to the
        selected member. The server also remembers your choice across
        devices.
      </p>

      <button
        type="button"
        onClick={() => pick(null)}
        aria-pressed={activeId == null}
        className={cn(
          "flex w-full items-center gap-3 rounded-inner px-3 py-3 text-left transition-colors hover:bg-surface-2",
          activeId == null && "bg-brand-soft"
        )}
      >
        <UserMinus size={18} className="text-text-soft" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Self (you)</p>
          <p className="t-micro">Show your own records only</p>
        </div>
      </button>

      {isLoading ? (
        <p className="px-3 py-4 text-sm text-text-soft">Loading…</p>
      ) : members.length === 0 ? (
        <p className="px-3 py-4 text-sm text-text-soft">
          No family members on file. Add one from the Family screen.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => pick(m.id)}
                aria-pressed={m.id === activeId}
                className={cn(
                  "flex w-full items-center gap-3 rounded-inner px-3 py-3 text-left transition-colors hover:bg-surface-2",
                  m.id === activeId && "bg-brand-soft"
                )}
              >
                <Users size={18} className="text-brand" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">
                    {m.name}
                  </p>
                  {m.relationship ? (
                    <p className="t-micro">{m.relationship}</p>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
