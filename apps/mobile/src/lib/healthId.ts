// QR-Code Check-in & Dispensing: client-side glue.
//
// This is the thin layer the screen + card call. It owns:
//   - React Query hooks for issue / current / revoke
//   - QR payload encoder (compact JSON: {t, p, h?})
//   - Rotation tick helper (interval-driven re-fetch)
//
// The screen renders a 240×240 QR via react-native-qrcode-svg. The card
// re-fetches a fresh token every `rotationSeconds` (default 25s) so the
// displayed code expires before the scanner could ever lock onto a stale
// read. Soft haptic on each tick reinforces the rotation for the live
// demo without being annoying.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { Platform, AppState } from "react-native";
import { api } from "@/lib/api";

// ─── Types (mirror packages/shared/src/types.ts) ───────────
// Local re-export so the mobile surface doesn't have to import the
// shared package (keeps the import graph small + screens feel native).
export type HealthIdPurpose = "checkin" | "dispense" | "id" | "all";

export interface HealthIdToken {
  token: string;
  purpose: HealthIdPurpose;
  rotationSeconds: number;
  expiresAt: string;
  scopes: string[];
}

// Default rotation cap. Matches the server default (30s) minus a 5s
// safety margin so the QR the camera reads is always the live one.
const DEFAULT_ROTATION_SECONDS = 25;
const QUERY_KEY = ["me", "health-id", "current"] as const;

// ─── React Query hooks ────────────────────────────────────

export function useCurrentHealthId(purpose: HealthIdPurpose = "all") {
  return useQuery({
    queryKey: [...QUERY_KEY, purpose],
    queryFn: () =>
      api<HealthIdToken | null>(
        `/me/health-id/current?purpose=${encodeURIComponent(purpose)}`,
      ),
    // Never serve stale data: re-issue on every focus + refetch on
    // reconnect so the QR shown matches the live row in D1.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useIssueHealthId() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (purpose: HealthIdPurpose = "all") =>
      api<HealthIdToken>("/me/health-id/issue", {
        method: "POST",
        body: { purpose },
      }),
    onSuccess: (data, purpose) => {
      qc.setQueryData([...QUERY_KEY, purpose], data);
      qc.invalidateQueries({ queryKey: ["me", "health-id"] });
    },
  });
}

export function useRevokeHealthId() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (purpose: HealthIdPurpose | null) =>
      api<{ revoked: number }>("/me/health-id/revoke", {
        method: "POST",
        body: purpose ? { purpose } : {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "health-id"] });
    },
  });
}

// ─── QR payload encoder ───────────────────────────────────
//
// The QR encodes a compact JSON blob the scanner uses to pre-fill
// `purpose` + `hospitalId` on the resolve call. The token itself is the
// authoritative lookup key — this is just metadata. If the QR were ever
// leaked the resolve endpoint already rate-limits + rejects revoked
// rows regardless of metadata.
export function encodeHealthIdPayload(
  token: string,
  purpose: HealthIdPurpose,
  hospitalId?: string | null,
): string {
  const payload: Record<string, string> = { t: token, p: purpose };
  if (hospitalId) payload.h = hospitalId;
  return JSON.stringify(payload);
}

// ─── Rotation tick ────────────────────────────────────────
//
// Returns `secondsRemaining` counting down from `rotationSeconds`. The
// caller should `useIssueHealthId().mutate()` (or refetch current) when
// the timer hits zero so a fresh token lands just before the displayed
// code becomes invalid.
//
// Pauses while the app is backgrounded so we don't issue tokens the
// user can't see.
export function useRotationTick(
  rotationSeconds: number = DEFAULT_ROTATION_SECONDS,
  onExpire?: () => void,
) {
  const [secondsRemaining, setSecondsRemaining] = useState(rotationSeconds);
  const [hapticArmed, setHapticArmed] = useState(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (cancelled) return;
      setSecondsRemaining(rotationSeconds);
      interval = setInterval(() => {
        setSecondsRemaining((s) => {
          const next = Math.max(0, s - 1);
          // Soft tick at 5s remaining; alarm at 0.
          if (next === 5 && !hapticArmed) {
            setHapticArmed(true);
            Haptics.selectionAsync().catch(() => {});
          }
          if (next === 0 && hapticArmed) {
            setHapticArmed(false);
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
            onExpireRef.current?.();
          }
          return next;
        });
      }, 1000);
    }

    function stop() {
      if (interval) clearInterval(interval);
      interval = null;
    }

    function handleVisibility(next: string) {
      if (next === "active") {
        start();
      } else {
        stop();
      }
    }

    start();
    const sub = AppState.addEventListener("change", handleVisibility);
    return () => {
      cancelled = true;
      stop();
      sub.remove();
    };
  }, [rotationSeconds, hapticArmed]);

  return secondsRemaining;
}

// ─── Haptic helper (re-export) ─────────────────────────────
export async function hapticForRotate(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Haptics.selectionAsync();
  } catch {
    /* expo-haptics unavailable (Jest, headless, …); ignore */
  }
}
