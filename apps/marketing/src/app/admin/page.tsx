"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/portal/stores/auth";

export default function AdminEntryPage() {
  const router = useRouter();
  const { token, user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (token && user?.role === "super_admin") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/admin/login");
    }
  }, [hydrated, token, user?.role, router]);

  return (
    <div className="min-h-screen grid place-items-center text-text-soft">
      <p className="text-sm">Loading…</p>
    </div>
  );
}