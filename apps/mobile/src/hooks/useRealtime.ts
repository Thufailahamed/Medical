"use client";

/**
 * useRealtime — mobile twin of the portal hook. Opens an EventSource
 * to /realtime and turns server-pushed notifications into React Query
 * invalidations so any visible list refreshes.
 *
 * Mounted once at the root of the authenticated surface. The auth
 * token lives in SecureStore (not Zustand) so we read it async on
 * connect. Falls back gracefully if EventSource is unavailable in
 * the current runtime — server-side realtime is best-effort.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";

import { useAuthStore } from "@/stores/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown | null;
  read: boolean;
  createdAt: string;
}

const TYPE_TO_QUERY_KEYS: Record<string, readonly (readonly string[])[]> = {
  appointment: [["appointments"], ["patient", "appointments"]],
  medicine: [["medicines"], ["doses"], ["patient", "medicines"]],
  lab_ready: [["medical-records"], ["patient", "records"], ["lab-orders"]],
  prescription: [["prescription"], ["prescriptions"], ["patient", "prescriptions"]],
  insurance: [["insurance"]],
  hospital: [["hospital"]],
  emergency: [["emergency"]],
  vaccination: [["vaccinations"]],
  general: [[]],
};

function invalidateFor(qc: ReturnType<typeof useQueryClient>, n: RealtimeNotification) {
  qc.invalidateQueries({ queryKey: ["notifications"] });
  const mapped = TYPE_TO_QUERY_KEYS[n.type];
  if (!mapped) return;
  for (const key of mapped) {
    if (key.length === 0) qc.invalidateQueries();
    else qc.invalidateQueries({ queryKey: key as readonly string[] });
  }
}

export function useRealtime() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (esRef.current) return;

    let cancelled = false;
    let es: EventSource | null = null;

    (async () => {
      let token: string | null = null;
      try {
        token = await SecureStore.getItemAsync("auth_token");
      } catch {
        token = null;
      }
      if (cancelled || !token) return;

      const url = `${API_URL}/realtime?token=${encodeURIComponent(token)}`;
      try {
        es = new EventSource(url, { withCredentials: false });
      } catch {
        // Some RN runtimes don't ship EventSource; silent best-effort.
        return;
      }
      esRef.current = es;

      es.addEventListener("notification", (ev) => {
        try {
          const n = JSON.parse((ev as MessageEvent).data) as RealtimeNotification;
          invalidateFor(qc, n);
        } catch {
          // ignore malformed payload
        }
      });

      es.addEventListener("ping", () => {
        // Heartbeat — keep-alive only.
      });

      es.onerror = () => {
        if (es && es.readyState === EventSource.CLOSED) {
          esRef.current = null;
        }
      };
    })();

    return () => {
      cancelled = true;
      es?.close();
      es = null;
      esRef.current = null;
    };
  }, [userId, qc]);
}