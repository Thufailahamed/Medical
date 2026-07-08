"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/hospital/stores/auth";
import { HospitalSidebar } from "@/hospital/components/shell/HospitalSidebar";
import { HospitalTopbar } from "@/hospital/components/shell/HospitalTopbar";

/**
 * (hospital) route group layout:
 *   - On mount, gates the URL by checking the auth store
 *   - If no token → /hospital/login (with `next` to come back here)
 *   - If a non-hospital role → /hospital/403
 *   - Otherwise renders the sidebar + topbar shell around the page
 *
 * The auth gate mirrors the doctor portal pattern. We can't pre-render
 * at build time because the auth state lives in localStorage; the
 * AuthBoot component (mounted at the root layout) runs /auth/me once
 * we know a token exists.
 */
const HOSPITAL_PORTAL_ROLES = [
  "hospital_admin",
  "hospital_staff",
  "pharmacy",
  "laboratory",
  "super_admin",
] as const;

export default function HospitalGroupLayout({
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
      router.replace(`/hospital/login?next=${next}`);
      return;
    }
    if (
      user &&
      user.role &&
      !HOSPITAL_PORTAL_ROLES.includes(user.role as any)
    ) {
      router.replace("/hospital/403");
    }
  }, [hydrated, token, user, router]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflowX;
    const prevBody = body.style.overflowX;

    html.style.overflowX = "visible";
    body.style.overflowX = "visible";

    return () => {
      html.style.overflowX = prevHtml;
      body.style.overflowX = prevBody;
    };
  }, []);

  // Avoid a flash of empty shell while zustand rehydrates.
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-text-soft">
        Loading…
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      <HospitalSidebar />
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto">
        <HospitalTopbar />
        <main className="flex-1 min-w-0 px-4 md:px-6 py-5 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}