"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/portal/stores/auth";
import { Sidebar } from "@/portal/components/shell/Sidebar";
import { Topbar } from "@/portal/components/shell/Topbar";
import { useRealtime } from "@/portal/hooks/useRealtime";

/**
 * (portal) route group layout:
 *   - On mount, gates the URL by checking the auth store
 *   - If no token → /login (with `next` to come back here)
 *   - If a non-clinician role → /403
 *   - Otherwise renders the sidebar + topbar shell around the page
 *
 * The portal serves both doctors (full chart) and pharmacists
 * (dispense surface at /portal/pharmacy). Pharmacy sees a role-
 * filtered sidebar so doctor-only routes stay hidden.
 *
 * We can't pre-render at build time because the auth state lives in
 * localStorage; the AuthBoot component runs the /auth/me call once we
 * know a token exists.
 */
const PORTAL_ROLES = ["doctor", "pharmacy"] as const;

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  // Live update: server pushes new notifications → React Query refresh.
  // Called before any early return so the hook order is stable.
  useRealtime({ token: token ?? null, userId: user?.id ?? null });

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      const next = encodeURIComponent(window.location.pathname);
      router.replace(`/login?next=${next}`);
      return;
    }
    if (user && user.role && !PORTAL_ROLES.includes(user.role as any)) {
      router.replace("/portal/403");
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
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto">
        <Topbar />
        <main className="flex-1 min-w-0 px-4 md:px-6 py-5 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}