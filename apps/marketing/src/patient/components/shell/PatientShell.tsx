"use client";

import { useAuthStore } from "@/portal/stores/auth";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Authenticated patient surface: soft canvas → rounded plate →
 * icon rail + main column (topbar + page).
 */
export function PatientShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-[100dvh] p-4 sm:p-6 lg:p-8">
      <div
        className="mx-auto flex max-w-[1400px] gap-5 p-3 sm:p-4 lg:gap-6 lg:p-5"
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-plate)",
          minHeight: "calc(100dvh - 3rem)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Topbar user={user} />
          <main className="flex-1 pb-2">{children}</main>
        </div>
      </div>
    </div>
  );
}
