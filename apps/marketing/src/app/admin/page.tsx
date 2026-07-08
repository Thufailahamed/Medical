"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/portal/stores/auth";

export default function AdminEntryPage() {
  const router = useRouter();
  const { token, user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      router.replace("/admin/login");
      return;
    }
    if (user.role === "super_admin") router.replace("/admin/dashboard");
    else if (user.role === "insurance") router.replace("/admin/insurance-claims");
    else if (user.role === "ambulance") router.replace("/admin/ambulances");
    else router.replace("/admin/login");
  }, [hydrated, token, user, router]);

  return (
    <div className="min-h-screen grid place-items-center text-text-soft">
      <p className="text-sm">Loading…</p>
    </div>
  );
}