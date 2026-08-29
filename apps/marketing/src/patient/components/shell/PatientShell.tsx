"use client";

import { useAuthStore } from "@/portal/stores/auth";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * The authenticated patient surface.
 *
 * Layout: canvas (`--color-canvas`) → plate (`--color-bg`, the rounded
 * dashboard container from the spec) → sidebar + main column.
 * The plate is the spec's "rounded dashboard container" — a single
 * rounded wrapper that holds the rail and the page content together.
 */
export function PatientShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-[100dvh] p-6 lg:p-8">
      <div
        className="mx-auto flex max-w-[1320px] gap-6 p-4 lg:p-6"
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-plate)",
          minHeight: "calc(100dvh - 4rem)",
        }}
      >
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Topbar user={user} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}