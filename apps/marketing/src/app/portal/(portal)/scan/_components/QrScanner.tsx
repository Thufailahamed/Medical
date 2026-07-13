"use client";

/**
 * /portal/scan/_components/QrScanner.tsx
 *
 * Tap-to-start camera QR scanner. We deliberately don't call
 * `getUserMedia` on mount because (a) iOS Safari requires a user
 * gesture to grant camera permission and (b) headless / Selenium /
 * non-secure-origin contexts fail noisily. The "Start Camera" button
 * is the gesture that unlocks the permission prompt.
 *
 * State machine:
 *   idle → requesting-permission → scanning → resolving → {
 *     redirected (on success),
 *     error (expired|wrongPurpose|revoked|noMatch|insecure)
 *   }
 *
 * On decode → POST /portal/scan/resolve with the active tenant id, then
 * router.replace to the right confirm page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  Camera,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldOff,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { api } from "@/portal/lib/api";
import { useAuthStore } from "@/portal/stores/auth";
import { cn } from "@/portal/lib/utils";

type Phase =
  | "idle"
  | "requesting"
  | "scanning"
  | "resolving"
  | "redirected"
  | "error";

type ErrorReason =
  | "permission_denied"
  | "insecure_origin"
  | "no_camera"
  | "not_found"
  | "revoked"
  | "expired"
  | "wrong_purpose"
  | "tenant_mismatch"
  | "max_scans_reached"
  | "rate_limited"
  | "no_match"
  | "unknown";

export interface QrScannerProps {
  purpose: "checkin" | "dispense" | "id" | "all";
  hospitalId?: string | null;
}

export function QrScanner({ purpose, hospitalId }: QrScannerProps) {
  const t = useT();
  const router = useRouter();
  const activeHospitalId = useAuthStore(
    (s) => s.activeHospitalId,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errReason, setErrReason] = useState<ErrorReason | null>(null);

  const tenantId = hospitalId ?? activeHospitalId ?? null;

  const stop = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* already stopped */
    }
    controlsRef.current = null;
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setErrReason(null);

    // Safari + iOS Safari refuse getUserMedia outside HTTPS or
    // localhost. We render a banner instead of throwing.
    if (
      typeof window !== "undefined" &&
      window.isSecureContext === false
    ) {
      setPhase("error");
      setErrReason("insecure_origin");
      return;
    }

    setPhase("requesting");
    try {
      const reader = new BrowserMultiFormatReader();
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices.length) {
        setPhase("error");
        setErrReason("no_camera");
        return;
      }
      const deviceId =
        devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
        devices[0].deviceId;
      setPhase("scanning");
      controlsRef.current = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        async (result, _err, controls) => {
          if (!result) return;
          // Pause further decodes by stopping immediately, then
          // resolve the token. Restart on error.
          controls.stop();
          await resolveToken(result.getText());
        },
      );
    } catch (err: any) {
      // zxing throws NotFoundException on every frame without a match;
      // we don't want to flip into error state for that.
      const name = err?.name ?? "";
      if (name === "NotFoundException" || name === "NotFoundError") return;
      setPhase("error");
      setErrReason(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "permission_denied"
          : "unknown",
      );
    }
  }, []);

  const resolveToken = useCallback(
    async (raw: string) => {
      setPhase("resolving");
      let token = raw.trim();
      try {
        // QR encodes a JSON blob with `t` (token) + `p` (purpose).
        // If we got a non-JSON string treat it as the raw token so we
        // still resolve — the server doesn't care about the metadata.
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && typeof parsed.t === "string") {
          token = parsed.t;
        }
      } catch {
        /* raw token */
      }

      try {
        const headers: Record<string, string> = {};
        if (tenantId) headers["x-active-hospital-id"] = tenantId;
        const data = await api<{
          patient: {
            id: string;
            name: string | null;
            photo: string | null;
            nic: string | null;
            dob: string | null;
            bloodGroup: string | null;
          };
          purpose: string;
          hospitalId: string | null;
          hospitalName: string | null;
          expiresAt: string;
          remainingScans: number;
        }>("/portal/scan/resolve", {
          method: "POST",
          json: { token, purpose },
          headers,
        });

        setPhase("redirected");
        // Route based on purpose. `all` defaults to the chart view.
        const p = data.purpose;
        if (p === "checkin" || purpose === "checkin") {
          router.replace(
            `/portal/check-in/confirm?patient=${encodeURIComponent(
              data.patient.id,
            )}&token=${encodeURIComponent(token)}`,
          );
        } else if (p === "dispense" || purpose === "dispense") {
          router.replace(
            `/portal/pharmacy?patient=${encodeURIComponent(
              data.patient.id,
            )}&via=${encodeURIComponent(token)}`,
          );
        } else {
          router.replace(
            `/portal/patients/${encodeURIComponent(data.patient.id)}/overview`,
          );
        }
      } catch (err: any) {
        setPhase("error");
        const reason = (err?.reason ?? err?.error ?? "").toString();
        setErrReason(mapReason(reason));
      }
    },
    [purpose, tenantId, router],
  );

  return (
    <div className="flex flex-col gap-5">
      {phase === "idle" || phase === "requesting" ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-surface px-6 py-8 text-center">
          <Camera className="mx-auto mb-3 text-primary" size={28} />
          <p className="text-sm text-text-soft mb-4 max-w-sm mx-auto">
            {t("scan.idleBody")}
          </p>
          <Button
            variant="primary"
            onClick={start}
            disabled={phase === "requesting"}
            leftIcon={<ScanLine size={16} />}
          >
            {phase === "requesting"
              ? t("scan.starting")
              : t("scan.startCamera")}
          </Button>
        </div>
      ) : null}

      {phase === "scanning" ? (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-w-sm mx-auto w-full">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-2/3 h-2/3 border-4 border-white/80 rounded-2xl" />
          </div>
          <button
            type="button"
            onClick={() => {
              stop();
              setPhase("idle");
            }}
            className="absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/90 text-slate-900 shadow"
          >
            {t("scan.cancel")}
          </button>
        </div>
      ) : null}

      {phase === "resolving" ? (
        <div className="rounded-2xl border border-border/60 bg-surface px-6 py-8 text-center">
          <Loader2 className="mx-auto mb-3 animate-spin text-primary" size={28} />
          <p className="text-sm text-text-soft">{t("scan.resolving")}</p>
        </div>
      ) : null}

      {phase === "redirected" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={28} />
          <p className="text-sm text-emerald-900 font-semibold">
            {t("scan.resolved")}
          </p>
        </div>
      ) : null}

      {phase === "error" && errReason ? (
        <div
          className={cn(
            "rounded-2xl border px-6 py-5 text-sm flex gap-3 items-start",
            errReason === "insecure_origin" || errReason === "permission_denied"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
          )}
        >
          {errReason === "insecure_origin" ? (
            <ShieldOff className="shrink-0 mt-0.5" size={18} />
          ) : (
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          )}
          <div className="flex-1">
            <div className="font-semibold mb-1">{t(`scan.${errReason}.title`)}</div>
            <div className="leading-relaxed">{t(`scan.${errReason}.body`)}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setErrReason(null);
            }}
            className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-text-soft"
          >
            <RefreshCw size={14} />
            {t("scan.tryAgain")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function mapReason(s: string): ErrorReason {
  switch (s) {
    case "not_found":
      return "no_match";
    case "revoked":
      return "revoked";
    case "expired":
      return "expired";
    case "purpose_mismatch":
      return "wrong_purpose";
    case "tenant_mismatch":
      return "tenant_mismatch";
    case "max_scans_reached":
      return "max_scans_reached";
    case "rate_limited":
      return "rate_limited";
    default:
      return "unknown";
  }
}
