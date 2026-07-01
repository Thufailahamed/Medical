// Phase 2.4: app lock store.
//
// What persists (SecureStore via zustand persist):
//   - pinHash:            the PBKDF2 hash of the user-chosen PIN
//   - biometricEnabled:   whether biometric is offered as the first
//                         prompt after the timeout elapses
//   - timeoutSeconds:     0 = lock immediately on background, otherwise
//                         seconds-of-background before relock kicks in
//
// What stays in-memory (never persisted):
//   - isLocked:           the runtime gate — true when the user must
//                         authenticate; flipped true on cold start (if
//                         hasPin), and on AppState `background → active`
//                         after more than timeoutSeconds of wall time
//   - lockedAt:           timestamp of the most recent lock event; used
//                         to compute timeout deltas.
//
// Note on multi-tasking: a brief OS-driven background (a notification,
// a phone call that's quickly dismissed) shouldn't relock. We compare
// `Date.now() - lockedAt` against `timeoutSeconds`; a transition
// that happened within the window is silently ignored.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";
import { hashPin, verifyPin } from "@/lib/appLock";

export type LockTimeout = 0 | 30 | 60 | 300 | -1;
// -1 means "never lock after auth" (PIN is still required on cold start,
// but the user can configure it off; -1 disables the background lock).

interface PersistedAppLock {
  pinHash: string | null;
  biometricEnabled: boolean;
  timeoutSeconds: number;
}

interface AppLockState extends PersistedAppLock {
  isLocked: boolean;
  lockedAt: number | null;
  hasPin: () => boolean;
  setPin: (pin: string) => Promise<void>;
  verifyAndUnlock: (pin: string) => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => void;
  setTimeoutSeconds: (s: LockTimeout) => void;
  lock: () => void;
  unlock: () => void;
  reset: () => Promise<void>;
}

export const useAppLockStore = create<AppLockState>()(
  persist(
    (set, get) => ({
      // Persisted.
      pinHash: null,
      biometricEnabled: false,
      timeoutSeconds: 60,

      // In-memory.
      isLocked: false,
      lockedAt: null,

      hasPin: () => !!get().pinHash,

      setPin: async (pin: string) => {
        const pinHash = await hashPin(pin);
        // Setting or changing the PIN keeps the app unlocked so the user
        // can transition back to the app shell seamlessly.
        set({ pinHash, isLocked: false, lockedAt: null });
      },

      verifyAndUnlock: async (pin: string) => {
        const { pinHash } = get();
        if (!pinHash) return false;
        const ok = await verifyPin(pin, pinHash);
        if (ok) {
          set({ isLocked: false, lockedAt: null });
        }
        return ok;
      },

      setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),

      setTimeoutSeconds: (s) => set({ timeoutSeconds: s }),

      lock: () => set({ isLocked: true, lockedAt: Date.now() }),

      unlock: () => set({ isLocked: false, lockedAt: null }),

      reset: async () => {
        // Wipes the PIN + biometric preference. SecureStore entry is
        // overwritten on next persist flush, so a future `set` clears
        // it. We also explicitly null every field immediately so the
        // in-memory state reflects "no lock" right away.
        set({
          pinHash: null,
          biometricEnabled: false,
          isLocked: false,
          lockedAt: null,
        });
      },
    }),
    {
      name: "healthcare-app-lock",
      storage: createJSONStorage(() => secureStorage),
      version: 1,
      // Only persist the three setup fields — never the runtime flags.
      partialize: (state) => ({
        pinHash: state.pinHash,
        biometricEnabled: state.biometricEnabled,
        timeoutSeconds: state.timeoutSeconds,
      }),
    }
  )
);
