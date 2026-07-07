"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/portal/stores/auth";
import { AdminSidebar } from "@/portal/components/admin/AdminSidebar";
import { AdminTopbar } from "@/portal/components/admin/AdminTopbar";

export default function AdminShellLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      router.replace(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (user.role !== "super_admin") {
      router.replace("/admin/403");
    }
  }, [hydrated, token, user?.role, router]);

  if (!hydrated || !user || user.role !== "super_admin") {
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
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}