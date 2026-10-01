"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useInsuranceOperatorAuthStore } from "./stores/auth";
import { loginHref } from "@/portal/lib/login";

export default function InsuranceOperatorRoot() {
  const router = useRouter();
  const isAuthenticated = useInsuranceOperatorAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    router.replace(
      isAuthenticated
        ? "/insurance-operator/dashboard"
        : loginHref({ port: "operator" }),
    );
  }, [isAuthenticated, router]);

  return (
    <div className="grid min-h-screen place-items-center bg-[#F0F9FF]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-sky-400/30" aria-hidden />
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_16px_36px_-12px_rgba(14,165,233,0.6)]">
            <ShieldCheck size={26} strokeWidth={2.25} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900">HealthHub Insurance</p>
          <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600">
            Opening insurer console…
          </p>
        </div>
      </div>
    </div>
  );
}
