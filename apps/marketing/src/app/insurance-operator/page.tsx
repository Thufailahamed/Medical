"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useInsuranceOperatorAuthStore } from "./stores/auth";

export default function InsuranceOperatorRoot() {
  const router = useRouter();
  const isAuthenticated = useInsuranceOperatorAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    router.replace(
      isAuthenticated
        ? "/insurance-operator/dashboard"
        : "/insurance-operator/login",
    );
  }, [isAuthenticated, router]);

  return null;
}