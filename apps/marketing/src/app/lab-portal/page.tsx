"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { useLabAuthStore } from "./stores/auth";
import { loginHref } from "@/portal/lib/login";

export default function LabPortalRoot() {
  const router = useRouter();
  const isAuthenticated = useLabAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    router.replace(
      isAuthenticated
        ? "/lab-portal/dashboard"
        : loginHref({ port: "facility", next: "/lab-portal/dashboard" }),
    );
  }, [isAuthenticated, router]);

  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-12 w-12 animate-pulse place-content-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
          <FlaskConical size={22} strokeWidth={2.2} />
        </div>
        <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Opening diagnostic console…
        </div>
      </div>
    </div>
  );
}
