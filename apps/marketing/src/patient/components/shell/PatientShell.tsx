"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useAuthStore } from "@/portal/stores/auth";
import { useUiStore } from "@/portal/stores/ui";
import { useActiveFamilyMember } from "@/patient/hooks/useActiveFamilyMember";
import { cn } from "@/portal/lib/utils";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Authenticated patient surface: soft canvas → rounded plate →
 * icon rail + main column (topbar + page).
 */
export function PatientShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const activeFamily = useActiveFamilyMember();
  const pathname = usePathname();
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const fullBleed = pathname?.startsWith("/patient/ai/chat") ?? false;

  // Drawer closes after every navigation.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

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
      {/* Desktop rail */}
      <div className="hidden h-full lg:block">
        <Sidebar />
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
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-2xl">
            <Sidebar forceExpanded />
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

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <Topbar user={user} />
        <div
          className={cn(
            "flex-1 min-w-0",
            fullBleed ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          <main
            className={cn(
              "w-full",
              fullBleed
                ? "h-full max-w-none p-0"
                : "min-h-full px-4 md:px-8 py-6 max-w-[1560px] mx-auto",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
