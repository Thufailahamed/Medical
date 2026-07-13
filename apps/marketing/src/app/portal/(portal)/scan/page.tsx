"use client";

/**
 * /portal/scan?purpose=checkin|dispense|id
 *
 * Server-side gating happens in (portal)/layout.tsx. This page reads
 * the `purpose` + `hospitalId` search params and mounts the client
 * `<QrScanner />`. Kept "use client" because the layout is a client
 * component already and the i18n hook lives on the client.
 */

import { useSearchParams } from "next/navigation";
import { ScanLine } from "lucide-react";

import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { QrScanner } from "./_components/QrScanner";

export default function ScanPage() {
  const t = useT();
  const sp = useSearchParams();
  const purposeParam = sp.get("purpose");
  const hospitalIdParam = sp.get("hospitalId");
  const p: "checkin" | "dispense" | "id" | "all" =
    purposeParam === "checkin" ||
    purposeParam === "dispense" ||
    purposeParam === "id"
      ? purposeParam
      : "all";

  const subtitleKey =
    p === "checkin"
      ? "scan.subtitle.checkin"
      : p === "dispense"
        ? "scan.subtitle.dispense"
        : "scan.subtitle.id";

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <PageHeader
        title={t("scan.title")}
        subtitle={t(subtitleKey)}
        icon={<ScanLine size={18} className="text-primary" />}
      />
      <QrScanner purpose={p} hospitalId={hospitalIdParam} />
    </div>
  );
}
