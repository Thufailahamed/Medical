"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/portal/stores/auth";
import { loginHref } from "@/portal/lib/login";

/**
 * Root path: if the user is signed in, push to the dashboard; otherwise
 * to the login screen. Doing this client-side avoids hard-coding a
 * server-side redirect (the token lives in localStorage).
 */
export default function Home() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(
      token ? "/portal/dashboard" : loginHref({ port: "doctor" }),
    );
  }, [hydrated, token, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-sm text-text-soft">Loading portal…</div>
    </main>
  );
}