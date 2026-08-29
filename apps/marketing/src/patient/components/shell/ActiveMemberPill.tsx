"use client";

// Phase 2.3: topbar pill rendered when the user is "acting as" a
// family member. Tapping opens the FamilyMemberPickerSheet so they
// can switch to a different member or back to Self. Hidden entirely
// when no active FM is set — matches mobile ActiveMemberPill.tsx:27.

import { useState } from "react";
import { UserCircle2 } from "lucide-react";

import { useFamilyMembers } from "@/patient/hooks/useActiveFamilyMember";
import { useActiveFamilyMemberStore } from "@/patient/stores/activeFamilyMember";

import { FamilyMemberPickerSheet } from "./FamilyMemberPickerSheet";

export function ActiveMemberPill() {
  const activeId = useActiveFamilyMemberStore((s) => s.activeFamilyMemberId);
  const { data } = useFamilyMembers();
  const [open, setOpen] = useState(false);

  if (!activeId) return null;

  const member = (data?.family ?? []).find((m) => m.id === activeId);
  const label = member?.name ?? "Family member";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Acting as ${label}. Tap to switch.`}
        data-testid="active-member-pill"
        className="inline-flex items-center gap-1.5 bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        <UserCircle2 size={14} aria-hidden />
        <span>{label}</span>
      </button>
      <FamilyMemberPickerSheet
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
