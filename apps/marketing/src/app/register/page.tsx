"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const role = params.get("role") || params.get("port");
    if (role === "doctor") {
      router.replace("/doctor/register");
    } else if (role === "hospital" || role === "facility") {
      router.replace("/hospital/register");
    } else {
      router.replace("/patient/register");
    }
  }, [router, params]);

  return null;
}

export default function RootRegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterRedirect />
    </Suspense>
  );
}
