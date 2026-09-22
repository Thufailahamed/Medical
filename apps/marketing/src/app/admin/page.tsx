"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/portal/stores/auth";
import { loginHref } from "@/portal/lib/login";

export default function AdminEntryPage() {
  const router = useRouter();
  const { token, user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      router.replace(loginHref({ port: "operator" }));
      return;
    }
    if (user.role === "super_admin") router.replace("/admin/dashboard");
    else if (user.role === "insurance") router.replace("/admin/insurance-claims");
    else if (user.role === "ambulance") router.replace("/admin/ambulances");
    else router.replace(loginHref({ port: "operator" }));
  }, [hydrated, token, user, router]);

  return (
    <div className="min-h-screen grid place-items-center admin-bg text-text-soft">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={22} className="animate-spin text-blue-600" />
        <p className="text-sm font-medium">Loading…</p>
      </div>
    </div>
  );
}