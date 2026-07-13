"use client";

/**
 * /portal/check-in/confirm?patient=<id>&token=<t>
 *
 * Reached after QrScanner resolves a checkin-purpose token. The card
 * here is the only thing on this page — the wrapper just adds a
 * back link + page header.
 */

import Link from "next/link";
import { ArrowLeft, ScanLine } from "lucide-react";

import { PageHeader } from "@/portal/components/ui/PageHeader";
import { CheckInConfirmCard } from "./_components/CheckInConfirmCard";
import { useT } from "@/portal/i18n";

export default function CheckInConfirmPage() {
  const t = useT();
  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <Link
        href="/portal/scan?purpose=checkin"
        className="text-xs text-text-soft inline-flex items-center gap-1.5 hover:text-text"
      >
        <ArrowLeft size={14} />
        {t("checkInConfirm.back")}
      </Link>
      <PageHeader
        title={t("checkInConfirm.title")}
        subtitle={t("checkInConfirm.subtitle")}
        icon={<ScanLine size={18} className="text-primary" />}
      />
      <CheckInConfirmCard />
    </div>
  );
}
