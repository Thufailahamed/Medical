"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/portal/stores/auth";
import { PatientShell } from "@/patient/components/shell/PatientShell";

/**
 * (app) route-group layout — the authenticated patient surface.
 *
 * Mirrors the role-gate pattern of portal/(portal)/layout.tsx. Login
 * and 403 live outside this group so they render ungated.
 *
 * Clinicians who land here are sent to 403 rather than to the doctor
 * portal: silently cross-navigating between role surfaces makes
 * permission bugs invisible.
 */
export const PATIENT_ROLES = ["patient"] as const;

export default function PatientAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      const next = encodeURIComponent(window.location.pathname);
      router.replace(`/patient/login?next=${next}`);
      return;
    }
    if (
      user &&
      user.role &&
      !PATIENT_ROLES.includes(user.role as (typeof PATIENT_ROLES)[number])
    ) {
      router.replace("/patient/403");
    }
  }, [hydrated, token, user, router]);

  if (!hydrated || !token) return null;

  return <PatientShell>{children}</PatientShell>;
}