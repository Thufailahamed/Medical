"use client";

import { useEffect } from "react";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";

export default function HospitalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useAuthStore((s) => s.locale);
  const t = useT();
  useEffect(() => {
    console.error("Hospital portal error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-12">
      <Card>
        <h1 className="text-xl font-semibold text-red-700">
          {t("errors.generic")}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {error.message ?? "Unexpected error"}
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={reset}>{t("common.refresh")}</Button>
        </div>
      </Card>
    </div>
  );
}