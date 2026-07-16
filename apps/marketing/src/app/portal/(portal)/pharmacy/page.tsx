"use client";

/**
 * /portal/pharmacy — pharmacy home page.
 *
 * Lists signed prescriptions awaiting dispense, with filter pills
 * to switch between awaiting / dispensed / rejected / all. The
 * default is `signed` — what a pharmacist needs at login.
 *
 * Reuses the hand-rolled `<ul>` row pattern from
 * /portal/prescriptions/page.tsx and the role-aware `<RxActions>` in
 * `mode="pharmacy"`, which renders Dispense + Reject buttons that
 * talk to /pharmacy/prescriptions/:id/{dispense,reject}.
 *
 * Phase QR-Code Check-in & Dispensing: when the pharmacist scanned a
 * patient QR the scanner redirects to /portal/pharmacy?patient=<id>
 * so this page filters the list to ONLY that patient's signed Rx.
 * A ?via=<token> param is forwarded to the dispense mutation so the
 * API can audit `prescription.dispensed_via_qr`.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Pill as PillIcon,
  FileText,
  ArrowRight,
  Pill,
  ScanLine,
  X as CloseIcon,
} from "lucide-react";

import { Card } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { RxActions } from "@/portal/components/rx/RxActions";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { rxStatusToTone } from "@/portal/lib/clinicalTones";
import { cn } from "@/portal/lib/utils";
import {
  usePharmacyPrescriptions,
  type PharmacyRxFilter,
} from "@/portal/hooks/usePharmacyPrescriptions";

const FILTERS: PharmacyRxFilter[] = ["signed", "dispensed", "cancelled", "all"];

const filterLabelKey: Record<PharmacyRxFilter, string> = {
  signed: "pharmacy.filter.awaiting",
  dispensed: "pharmacy.filter.dispensed",
  cancelled: "pharmacy.filter.rejected",
  all: "pharmacy.filter.all",
};

const emptyKey: Record<PharmacyRxFilter, string> = {
  signed: "pharmacy.empty.awaiting",
  dispensed: "pharmacy.empty.dispensed",
  cancelled: "pharmacy.empty.rejected",
  all: "pharmacy.empty.awaiting",
};

export default function PharmacyListPage() {
  const t = useT();
  const sp = useSearchParams();
  // QR-Code: when the scan redirected us, ?patient=<id> filters
  // the list to only that patient's signed Rx. ?via=<token> is
  // forwarded into the dispense mutation so the API can audit a
  // parallel `prescription.dispensed_via_qr` row.
  const patientQ = sp.get("patient");
  const viaQ = sp.get("via");
  const [status, setStatus] = useState<PharmacyRxFilter>("signed");
  const { data, isLoading } = usePharmacyPrescriptions({
    status,
    patientId: patientQ,
  });

  const rows = data?.prescriptions ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("pharmacy.title")}
        subtitle={t("pharmacy.subtitle")}
        icon={<Pill size={18} className="text-emerald-600" />}
      />

      {patientQ ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-900 px-4 py-2.5 text-sm">
          <div className="inline-flex items-center gap-2 min-w-0">
            <ScanLine size={16} />
            <span className="truncate">
              {t("pharmacy.qrFiltered", {
                patient: `…${patientQ.slice(-6)}`,
                via: viaQ ? t("pharmacy.viaQr") : "",
              })}
            </span>
          </div>
          <Link
            href="/portal/pharmacy"
            className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          >
            <CloseIcon size={12} />
            {t("pharmacy.clearFilter")}
          </Link>
        </div>
      ) : null}

      <Card padding={false} className="rounded-2xl border-border/50">
        <div className="px-4 py-3 flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatus(f)}
              className={cn(
                "px-2.5 h-7 rounded-xl text-xs border transition-colors",
                status === f
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                  : "bg-surface text-text-soft border-border/60 hover:bg-surface-2/40"
              )}
            >
              {t(filterLabelKey[f])}
            </button>
          ))}
        </div>
      </Card>

      <Card padding={false} className="rounded-2xl border-border/50">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty
            title={
              patientQ
                ? t("scan.noPendingRx")
                : t(emptyKey[status])
            }
            className="py-12"
          />
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => (
              <li
                key={r.id}
                className="group flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors"
              >
                <Link
                  href={`/portal/pharmacy/${r.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <PillIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-text truncate">
                        {r.patient?.name ?? "—"}
                      </span>
                      <PillBadge tone={rxStatusToTone(r.status)}>
                        {t(`rx.status.${r.status}`)}
                      </PillBadge>
                    </div>
                    <div className="text-xs text-text-soft truncate">
                      {r.diagnosis ?? t("prescription.untitled")} ·{" "}
                      {r.medicineCount} meds
                      {r.patient?.nic ? ` · ${r.patient.nic}` : ""}
                    </div>
                  </div>
                  {r.date ? (
                    <span className="text-xs text-text-muted shrink-0">
                      {formatDate(r.date)}
                    </span>
                  ) : null}
                  <span className="text-xs text-brand font-medium opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5 shrink-0">
                    {t("pharmacy.actions.view")}
                    <ArrowRight size={12} />
                  </span>
                </Link>
                <RxActions
                  id={r.id}
                  status={r.status}
                  hideEdit
                  compact
                  mode="pharmacy"
                  dispenseToken={r.dispenseToken}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
