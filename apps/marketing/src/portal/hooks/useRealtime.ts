"use client";

/**
 * useRealtime — opens an EventSource to /realtime and turns the
 * server-pushed `notification` events into React Query invalidations.
 *
 * Mounted once near the root of an authenticated surface (e.g. inside
 * `(portal)/layout.tsx`, `(hospital)/layout.tsx`, or `(admin)/layout.tsx`).
 * No-op if there's no auth token yet — the layout re-runs the effect
 * once the token hydrates from localStorage.
 *
 * Why a polling SSE (server emits every 2s) and not WebSockets?
 *   - Cloudflare Workers + D1 + Bun all speak SSE natively.
 *   - Server can keep connections across the worker 30s CPU limit by
 *     using a small per-tick sleep + a long-lived stream.
 *   - No new infra (Durable Objects / Redis pub/sub).
 *
 * The hook is auth-store-agnostic: callers pass `{ token, user }`
 * directly so the same hook works for `/portal/*` (uses portal auth
 * store), `/hospital/*` (uses hospital auth store) and `/admin/*`.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { API_URL } from "@/portal/lib/api";
import { toast } from "@/portal/components/ui/Toast";

export interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown | null;
  read: boolean;
  createdAt: string;
}

/**
 * Notification-type → query keys to invalidate. Add new mappings here
 * when introducing a new notify() domain (e.g. "lab_ready" invalidates
 * lab queries).
 */
const TYPE_TO_QUERY_KEYS: Record<string, readonly (readonly string[])[]> = {
  appointment: [["appointments"], ["doctor-portal", "appointments"], ["patient", "appointments"]],
  medicine: [["medicines"], ["doses"]],
  lab_ready: [["lab-orders"], ["doctor-portal", "lab-orders"], ["medical-records"]],
  prescription: [["prescription"], ["doctor", "prescriptions"], ["doctor-portal", "prescriptions"]],
  insurance: [["insurance"], ["admin", "insurance-claims"]],
  hospital: [["hospital-portal"], ["doctor-portal"]],
  emergency: [["emergency"]],
  vaccination: [["vaccinations"]],
  general: [[]],
  account_pending_review: [["admin", "approvals"], ["admin", "users"]],
};

function invalidateFor(qc: ReturnType<typeof useQueryClient>, n: RealtimeNotification) {
  // Catch-all first — anything matching the `notifications` tree refreshes.
  qc.invalidateQueries({ queryKey: ["notifications"] });
  const mapped = TYPE_TO_QUERY_KEYS[n.type];
  if (mapped) {
    for (const key of mapped) {
      if (key.length === 0) {
        // `general` → nuke everything. Be aggressive only when the
        // server marks a notification as general (no specific bucket).
        qc.invalidateQueries();
      } else {
        qc.invalidateQueries({ queryKey: key as readonly string[] });
      }
    }
  }
}

export interface UseRealtimeArgs {
  token: string | null;
  /** Authenticated user. Required so we know when to connect. */
  userId: string | null;
  /** When true, don't surface a toast for each event. */
  silent?: boolean;
}

export function useRealtime({ token, userId, silent }: UseRealtimeArgs) {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token || !userId) return;
    if (typeof window === "undefined") return;
    if (esRef.current) return; // already connected

    // EventSource can't send custom headers — token goes on the URL.
    // Server's auth middleware accepts `?token=` for /realtime specifically.
    const url = `${API_URL}/realtime?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url, { withCredentials: false });
    esRef.current = es;

    es.addEventListener("hello", () => {
      // Connection confirmed — could be used to flip a "live" badge.
    });

    es.addEventListener("notification", (ev) => {
      try {
        const n = JSON.parse((ev as MessageEvent).data) as RealtimeNotification;
        invalidateFor(qc, n);
        if (!silent) {
          toast.info(n.title, n.body);
        }
      } catch {
        // ignore malformed payload
      }
    });

    es.addEventListener("ping", () => {
      // Heartbeat — keep-alive only. No-op here.
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        esRef.current = null;
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [token, userId, qc, silent]);
}