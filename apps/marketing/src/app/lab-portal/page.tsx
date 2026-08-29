"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLabAuthStore } from "./stores/auth";
import { loginHref } from "@/portal/lib/login";

export default function LabPortalRoot() {
  const router = useRouter();
  const isAuthenticated = useLabAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    router.replace(
      isAuthenticated
        ? "/lab-portal/dashboard"
        : loginHref({ port: "facility" }),
    );
  }, [isAuthenticated, router]);

  return null;
}
