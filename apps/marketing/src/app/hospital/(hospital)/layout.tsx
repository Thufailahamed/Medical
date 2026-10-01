"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";

import { useAuthStore } from "@/hospital/stores/auth";
import { useUiStore } from "@/hospital/stores/ui";
import { HospitalSidebar } from "@/hospital/components/shell/HospitalSidebar";
import { HospitalTopbar } from "@/hospital/components/shell/HospitalTopbar";
import { useRealtime } from "@/portal/hooks/useRealtime";
import { loginHref } from "@/portal/lib/login";

/**
 * (hospital) route group layout:
 *   - On mount, gates the URL by checking the auth store
 *   - If no token → /login?port=facility (with `next` to come back here)
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
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace(
        loginHref({ port: "facility", next: window.location.pathname }),
      );
      return;
    }
    if (
      user &&
      user.role &&
      !HOSPITAL_PORTAL_ROLES.includes(user.role as (typeof HOSPITAL_PORTAL_ROLES)[number])
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

  // Live update: server pushes new notifications → React Query refresh.
  // Called before any early return so the hook order is stable.
  useRealtime({ token: token ?? null, userId: user?.id ?? null });

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
      {/* Desktop rail */}
      <div className="hidden h-full lg:block">
        <HospitalSidebar />
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[272px] max-w-[85vw] shadow-2xl">
            <HospitalSidebar forceExpanded />
          </div>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <X size={17} aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto">
        <HospitalTopbar />
        <main className="flex-1 min-w-0 px-4 md:px-6 py-5 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}