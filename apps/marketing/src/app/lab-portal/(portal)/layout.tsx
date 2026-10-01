"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLabAuthStore } from "../stores/auth";
import { loginHref } from "@/portal/lib/login";
import { LabSidebar } from "../components/shell/LabSidebar";
import { LabTopbar } from "../components/shell/LabTopbar";

const emptySubscribe = () => () => {};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useLabAuthStore();

  // Defer rendering until the client has mounted to avoid hydration mismatches
  // with Zustand persist in localStorage.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) {
      router.push(loginHref({ port: "facility", next: pathname || "/lab-portal/dashboard" }));
    }
  }, [mounted, isAuthenticated, router, pathname]);

  // Match server (renders nothing) on the very first client paint to
  // avoid a hydration mismatch; the effect above then either renders
  // the chrome or redirects to login.
  if (!mounted) return null;
  if (!isAuthenticated()) return null;

  return (
    <div className="flex min-h-screen bg-[var(--lab-bg)]">
      <LabSidebar />
      <div className="lab-bg-grain flex min-w-0 flex-1 flex-col">
        <LabTopbar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
