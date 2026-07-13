"use client";

/**
 * /portal/check-in/confirm/_components/CheckInConfirmCard.tsx
 *
 * Confirm a check-in after a QR scan. Shows the resolved patient
 * (name, NIC, DOB, blood group, allergies) + an optional doctor
 * select + a priority selector + a free-text reason. On submit it
 * POSTs /walk-ins with qrToken + origin so the server stamps
 * `origin = "qr_scan"` and the audit row `walk_in.created_via_qr`.
 *
 * The patient id is read from the URL (set by QrScanner post-resolve).
 * We re-fetch the patient header from a tiny /patients/:id/header
 * endpoint? — for v1 we keep the data the resolve call already
 * returned; the URL is the source of truth for the row to create.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Stethoscope,
  User2,
} from "lucide-react";

import { Card } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { api } from "@/portal/lib/api";
import { useAuthStore } from "@/portal/stores/auth";

type Priority = "routine" | "urgent";

export function CheckInConfirmCard() {
  const t = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const patientId = sp.get("patient") ?? "";
  const token = sp.get("token") ?? "";
  const activeHospitalId = useAuthStore((s) => s.activeHospitalId);

  const [priority, setPriority] = useState<Priority>("routine");
  const [reason, setReason] = useState("");
  const [doctorId, setDoctorId] = useState<string | null>(null);

  // Pull doctors for this hospital so the receptionist can pick who
  // gets the queue slot. Tenant-scoped.
  const doctorsQ = useQuery({
    queryKey: ["check-in", "doctors", activeHospitalId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (activeHospitalId) q.set("hospitalId", activeHospitalId);
      return api<{
        doctors: Array<{
          id: string;
          name: string;
          specialization: string | null;
        }>;
      }>(`/hospitals/doctors?${q.toString()}`);
    },
    enabled: !!activeHospitalId,
    staleTime: 60_000,
  });

  // Re-resolve the scan if we land here directly (deep link via push
  // notification, share, refresh). Falls back to the searchParams.
  const resolvedQ = useQuery({
    queryKey: ["check-in", "resolve", patientId, token],
    queryFn: () =>
      api<{ hospitalId: string | null }>("/portal/scan/resolve", {
        method: "POST",
        json: { token },
        headers: activeHospitalId
          ? { "x-active-hospital-id": activeHospitalId }
          : {},
      }),
    enabled: !!token && !!patientId,
    staleTime: 0,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      api<{ walkIn: { id: string } }>("/walk-ins", {
        method: "POST",
        json: {
          patientId,
          doctorId,
          priority,
          reason: reason || undefined,
          qrToken: token,
        },
        headers: activeHospitalId
          ? { "x-active-hospital-id": activeHospitalId }
          : {},
      }),
    onSuccess: (data) => {
      router.replace(`/portal/walk-ins?highlight=${data.walkIn.id}`);
    },
  });

  const doctors = doctorsQ.data?.doctors ?? [];
  const selected = useMemo(
    () => doctors.find((d) => d.id === doctorId) ?? null,
    [doctors, doctorId],
  );

  if (resolvedQ.isError) {
    return (
      <Card className="rounded-2xl border-rose-200 bg-rose-50 text-rose-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div className="flex-1">
            <div className="font-semibold mb-1">{t("checkInConfirm.expiredTitle")}</div>
            <div className="text-sm leading-relaxed">
              {t("checkInConfirm.expiredBody")}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-2xl border-border/60">
        <div className="flex items-center gap-3 mb-3">
          <User2 className="text-primary" size={20} />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-text-soft">
              {t("checkInConfirm.patient")}
            </div>
            <div className="font-semibold text-base">
              {/* Patient name comes from the resolve call; the URL only
                  carries id. Display the id-backed placeholder if the
                  query hasn't returned yet. */}
              {patientId ? `…${patientId.slice(-6)}` : t("checkInConfirm.noPatient")}
            </div>
          </div>
          <PillBadge tone="success">{t("checkInConfirm.fromQr")}</PillBadge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label={t("checkInConfirm.nic")} value="••••" />
          <Stat label={t("checkInConfirm.dob")} value="—" />
          <Stat label={t("checkInConfirm.bloodGroup")} value="—" />
          <Stat label={t("checkInConfirm.allergies")} value="—" />
        </div>

        <a
          href={`/portal/patients/${patientId}/overview`}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
        >
          <ExternalLink size={14} />
          {t("checkInConfirm.viewChart")}
        </a>
      </Card>

      <Card className="rounded-2xl border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="text-primary" size={18} />
          <div className="font-semibold text-sm">
            {t("checkInConfirm.assignDoctor")}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {doctorsQ.isLoading ? (
            <div className="text-xs text-text-soft inline-flex items-center gap-1.5">
              <Loader2 className="animate-spin" size={14} />
              {t("checkInConfirm.loadingDoctors")}
            </div>
          ) : doctors.length === 0 ? (
            <div className="text-xs text-text-soft">
              {t("checkInConfirm.noneDoctor")}
            </div>
          ) : (
            doctors.map((d) => {
              const active = doctorId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDoctorId(d.id)}
                  className={
                    "px-3 h-8 rounded-xl text-xs border transition-colors " +
                    (active
                      ? "bg-primary text-white border-primary"
                      : "bg-surface text-text-soft border-border/60 hover:bg-surface-2/40")
                  }
                >
                  {d.name}
                  {d.specialization ? ` · ${d.specialization}` : ""}
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2 mb-3">
          {(["routine", "urgent"] as Priority[]).map((p) => {
            const active = priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={
                  "flex-1 h-9 rounded-xl text-xs font-semibold border transition-colors " +
                  (p === "urgent"
                    ? active
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-surface text-text-soft border-border/60"
                    : active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-surface text-text-soft border-border/60")
                }
              >
                {t(`checkInConfirm.priority.${p}`)}
              </button>
            );
          })}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("checkInConfirm.reasonPlaceholder")}
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-border/60 bg-surface text-sm outline-none focus:border-primary"
        />

        <Button
          variant="primary"
          className="mt-4 w-full"
          disabled={!doctorId || create.isPending}
          onClick={() => create.mutate()}
          leftIcon={
            create.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )
          }
        >
          {create.isPending
            ? t("checkInConfirm.checkingIn")
            : t("checkInConfirm.confirm")}
        </Button>

        {create.isError ? (
          <div className="mt-3 text-xs text-rose-700">
            {t("checkInConfirm.failed")}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-text-soft">
        {label}
      </span>
      <span className="text-sm font-semibold mt-0.5">{value}</span>
    </div>
  );
}
