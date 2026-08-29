"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

  return null;
}