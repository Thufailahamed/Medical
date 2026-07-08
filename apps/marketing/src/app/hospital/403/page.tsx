"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldOff, ArrowLeft, LogOut } from "lucide-react";

import { Button } from "@/portal/components/ui/Button";
import { useAuthStore } from "@/hospital/stores/auth";
import { logout } from "@/hospital/lib/auth";
import { useT } from "@/hospital/i18n";

/**
 * Forbidden page. Reached when an authenticated user without the right
 * hospital/clinic role lands on /hospital/* (e.g. patient, doctor).
 */
export default function ForbiddenPage() {
  const router = useRouter();
  const t = useT();
  const user = useAuthStore((s) => s.user);

  async function onLogout() {
    await logout();
    router.replace("/hospital/login");
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-danger-soft border border-danger/20 flex items-center justify-center mb-6 shadow-sm">
          <ShieldOff size={26} className="text-danger" />
        </div>
        <h1 className="text-2xl font-extrabold text-text tracking-tight">
          {t("errors.forbidden")}
        </h1>
        <p className="text-sm text-text-soft mt-3 leading-relaxed">
          {user
            ? `Your account (${user.role}) doesn't have access to the hospital portal. Use the patient app or doctor portal instead.`
            : "You don't have access to this facility."}
        </p>
        <div className="mt-7 flex items-center justify-center gap-2.5">
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft size={14} /> {t("common.back")}
          </Button>
          <Button variant="primary" onClick={onLogout}>
            <LogOut size={14} /> {t("shell.logout")}
          </Button>
        </div>
        <Link href="/" className="block mt-6 text-xs text-text-muted hover:text-text-soft">
          {t("auth.backToSite")}
        </Link>
      </div>
    </div>
  );
}