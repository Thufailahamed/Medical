"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/portal/stores/auth";
import { AdminSidebar } from "@/portal/components/admin/AdminSidebar";
import { AdminTopbar } from "@/portal/components/admin/AdminTopbar";
import { StepUpModal } from "@/portal/components/admin/StepUpModal";
import { ImpersonationBanner } from "@/portal/components/admin/ImpersonationBanner";
import { useRealtime } from "@/portal/hooks/useRealtime";

const ADMIN_ROLES = ["super_admin", "insurance", "ambulance"] as const;

export default function AdminShellLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      router.replace(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
      router.replace("/admin/403");
    }
  }, [hydrated, token, user?.role, router]);

  if (
    !hydrated ||
    !user ||
    !ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])
  ) {
    return (
      <div className="min-h-screen grid place-items-center text-text-soft text-sm">
        Verifying admin session…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg admin-bg">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar />
        <ImpersonationBanner />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
      <StepUpModal />
      <RealtimeBridge token={token ?? null} userId={user.id} />
    </div>
  );
}

function RealtimeBridge({ token, userId }: { token: string | null; userId: string }) {
  useRealtime({ token, userId });
  return null;
}