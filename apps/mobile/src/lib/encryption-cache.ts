// Mobile-side DEK cache. Per device, in-memory only — never written to
// AsyncStorage or SecureStore. Cleared on logout + when the app is
// backgrounded for more than `INACTIVITY_TIMEOUT_MS`.
//
// Phase v3: server is the source of truth for envelope encryption; the
// mobile cache is only an optimisation to avoid re-decrypting on every
// list render.

const INACTIVITY_TIMEOUT_MS = 5 * 60_000;

interface CacheEntry {
  dek: Uint8Array;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();
let lastActivity = Date.now();

function purgeExpired(now: number) {
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now) store.delete(k);
  }
}

function touch() {
  lastActivity = Date.now();
}

export const envelopeCache = {
  put(recordId: string, dek: Uint8Array, ttlMs = INACTIVITY_TIMEOUT_MS) {
    touch();
    store.set(recordId, {
      dek: new Uint8Array(dek), // copy so callers can't mutate
      expiresAt: Date.now() + ttlMs,
    });
  },
  get(recordId: string): Uint8Array | null {
    touch();
    purgeExpired(Date.now());
    const e = store.get(recordId);
    return e ? new Uint8Array(e.dek) : null;
  },
  clear() {
    store.clear();
    lastActivity = Date.now();
  },
  size(): number {
    purgeExpired(Date.now());
    return store.size;
  },
  /** Called by app-state listener to clear on prolonged background. */
  onInactivity(): boolean {
    if (Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
      this.clear();
      return true;
    }
    return false;
  },
};

/**
 * Simple passphrase gate: returns true when the user has unlocked
 * within the last `MEMORY_MS`. Used to gate sensitive screens like
 * RecordRevisionsHistory.
 */
const MEMORY_MS = 30 * 60_000;
let lastUnlock = 0;

export const passphraseGate = {
  unlock() {
    lastUnlock = Date.now();
  },
  isUnlocked(): boolean {
    return Date.now() - lastUnlock < MEMORY_MS;
  },
  lock() {
    lastUnlock = 0;
  },
};