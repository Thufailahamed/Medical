"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldOff, ArrowLeft, LogOut } from "lucide-react";

import { Button } from "@/portal/components/ui/Button";
import { useAuthStore } from "@/portal/stores/auth";

/**
 * Forbidden page for the portal route. Reached when a non-doctor user
 * (e.g. patient on /portal/dashboard, or hospital staff on /portal/patients)
 * lands on a doctor-only URL. Patient users should be on /portal/me.
 */
export default function ForbiddenPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function onLogout() {
    logout();
    router.replace("/login");
  }

  const role = user?.role;
  const suggested =
    role === "patient"
      ? "/portal/me"
      : role === "hospital_admin" || role === "hospital_staff"
        ? "/hospital"
        : "/login";

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-danger-soft border border-danger/20 flex items-center justify-center mb-6 shadow-sm">
          <ShieldOff size={26} className="text-danger" />
        </div>
        <h1 className="text-2xl font-extrabold text-text tracking-tight">
          403 — Wrong portal
        </h1>
        <p className="text-sm text-text-soft mt-3 leading-relaxed">
          {user
            ? `Your account (${user.role}) doesn't have access to this area.`
            : "You don't have access to this area."}
        </p>
        <div className="mt-7 flex items-center justify-center gap-2.5">
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft size={14} /> Back
          </Button>
          <Button variant="primary" onClick={() => router.replace(suggested)}>
            Go to your portal
          </Button>
          <Button variant="ghost" onClick={onLogout}>
            <LogOut size={14} /> Sign out
          </Button>
        </div>
        <Link
          href="/"
          className="block mt-6 text-xs text-text-muted hover:text-text-soft"
        >
          Back to site
        </Link>
      </div>
    </div>
  );
}