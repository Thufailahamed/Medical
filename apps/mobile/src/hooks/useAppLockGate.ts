// Phase 2.4: app-lock routing gate.
//
// Single source of truth for:
//   - mounting the AppState listener that relocks the app after the
//     user-configured background timeout
//   - deciding which screen to show when auth state and lock state
//     collide (authed + no PIN → /lock/setup; authed + locked → /lock)
//
// We do all of this from one hook so the root layout doesn't accumulate
// effect-laced conditionals. The hook is also the right place to wait
// for `useAppLockStore.persist` to hydrate — SecureStore is async, so
// reading `pinHash` synchronously on first render would race.

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useAppLockStore } from "@/stores/appLock";

export function useAppLockGate() {
  const router = useRouter();
  const segments = useSegments();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLocked = useAppLockStore((s) => s.isLocked);
  const pinHash = useAppLockStore((s) => s.pinHash);
  const timeoutSeconds = useAppLockStore((s) => s.timeoutSeconds);
  const lock = useAppLockStore((s) => s.lock);

  // Track persisted-hydration so we don't kick the user to /lock before
  // the SecureStore blob has actually loaded (cold start, fresh process).
  const [hasHydrated, setHasHydrated] = useState(
    useAppLockStore.persist.hasHydrated(),
  );
  useEffect(() => {
    if (hasHydrated) return;
    const unsub = useAppLockStore.persist.onFinishHydration(() =>
      setHasHydrated(true),
    );
    if (useAppLockStore.persist.hasHydrated()) setHasHydrated(true);
    return unsub;
  }, [hasHydrated]);

  // ---- Cold-start relock -------------------------------------------------
  // If we already have a PIN (post-hydration) and the in-memory flag
  // hasn't been flipped on, flip it. This is what gates the user behind
  // /lock on every cold start.
  useEffect(() => {
    if (!hasHydrated) return;
    if (pinHash && !isLocked) {
      lock();
    }
  }, [hasHydrated, pinHash, isLocked, lock]);

  // ---- Background-timeout gating ----------------------------------------
  // `Date.now() - lockedAt` measures wall-time since the last lock event.
  // On `active` transition, if more than `timeoutSeconds` have elapsed
  // since `background`, set isLocked=true.
  //
  // We track `backgroundedAt` as a ref so the AppState handler doesn't
  // have to read the store (avoids stale-closure on every event).
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    function onChange(next: AppStateStatus) {
      if (next === "background" || next === "inactive") {
        backgroundedAtRef.current = Date.now();
      } else if (next === "active") {
        // Only meaningful when authenticated. The login screen has its
        // own state and we don't want to relock before sign-in.
        if (!useAuthStore.getState().isAuthenticated) return;
        const since = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (since == null) return;
        const elapsedSec = (Date.now() - since) / 1000;
        if (elapsedSec >= timeoutSeconds) {
          lock();
        }
      }
    }
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [lock, timeoutSeconds]);

  // ---- Route gate --------------------------------------------------------
  // The lock group sits outside (auth) and (app). The decision tree:
  //   - no PIN            + authed       → /lock/setup  (first-time)
  //   - has PIN + locked  + authed       → /lock        (re-authenticate)
  //   - otherwise                         → let the regular group
  //                                          router handle it
  useEffect(() => {
    if (!hasHydrated) return;
    const inLockGroup = segments[0] === "lock";

    if (isAuthenticated && !pinHash && !inLockGroup) {
      router.replace("/lock/setup");
      return;
    }
    if (isAuthenticated && pinHash && isLocked && !inLockGroup) {
      router.replace("/lock");
      return;
    }
    // Auth dropped while we were on /lock: kick back to login.
    if (!isAuthenticated && inLockGroup) {
      router.replace("/(auth)/login");
      return;
    }
  }, [
    hasHydrated,
    isAuthenticated,
    pinHash,
    isLocked,
    segments,
    router,
  ]);
}
