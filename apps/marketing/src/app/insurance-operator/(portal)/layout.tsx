"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useInsuranceOperatorAuthStore } from "../stores/auth";
import { loginHref } from "@/portal/lib/login";
import { InsSidebar } from "../components/shell/InsSidebar";
import { InsTopbar } from "../components/shell/InsTopbar";

const emptySubscribe = () => () => {};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useInsuranceOperatorAuthStore();

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
      router.push(
        loginHref({ port: "operator", next: pathname || "/insurance-operator/dashboard" }),
      );
    }
  }, [mounted, isAuthenticated, router, pathname]);

  // Match server (renders nothing) on the very first client paint to
  // avoid a hydration mismatch; the effect above then either renders
  // the chrome or redirects to login.
  if (!mounted) return null;
  if (!isAuthenticated()) return null;

  return (
    <div className="flex min-h-screen bg-[#F0F9FF]">
      <InsSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <InsTopbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
