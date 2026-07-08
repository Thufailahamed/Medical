"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/hospital/stores/auth";

/**
 * Hospital portal root. If signed in, push to dashboard; otherwise the
 * login page. Mirrors the doctor-portal /portal root.
 */
export default function HospitalHome() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(token ? "/hospital/dashboard" : "/hospital/login");
  }, [hydrated, token, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-sm text-text-soft">Loading hospital portal…</div>
    </main>
  );
}