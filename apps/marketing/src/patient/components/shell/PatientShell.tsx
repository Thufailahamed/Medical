"use client";

import { useAuthStore } from "@/portal/stores/auth";
import { useActiveFamilyMember } from "@/patient/hooks/useActiveFamilyMember";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Authenticated patient surface: soft canvas → rounded plate →
 * icon rail + main column (topbar + page).
 */
export function PatientShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const activeFamily = useActiveFamilyMember();

  if (activeFamily.isLoading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6 text-sm text-text-soft">
        Loading your health context…
      </div>
    );
  }

  if (activeFamily.isError) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <p className="text-sm text-text-soft">We couldn’t load your health context.</p>
          <button
            type="button"
            onClick={() => activeFamily.refetch()}
            className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-[1560px] w-full mx-auto flex flex-col gap-6">
            <Topbar user={user} />
            <main className="flex-1 pb-8">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
