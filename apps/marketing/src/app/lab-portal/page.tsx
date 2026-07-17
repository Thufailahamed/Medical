"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLabAuthStore } from "./stores/auth";

export default function LabPortalRoot() {
  const router = useRouter();
  const isAuthenticated = useLabAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    router.replace(isAuthenticated ? "/lab-portal/dashboard" : "/lab-portal/login");
  }, [isAuthenticated, router]);

  return null;
}
