// @ts-nocheck
//
// Atomicity helpers for the doctor↔patient enterprise architecture.
//
// Background
// ----------
// D1 (Cloudflare's SQLite) serialises per-database writes, but each
// HTTP request is its own logical transaction boundary. Multi-step
// endpoints (visit-summary, prescription create, signature, message
// send, payout) used to issue 3-6 sequential writes with no
// transactional wrapper — a crash or network blip mid-loop left
// orphan rows in `prescriptions` (no mirror), `medicines` (no doses),
// `walk_ins` (status flipped but no revenue event) etc.
//
// These helpers bring every mutation under a single SQLite
// transaction so partial failure rolls the whole batch back.
//
// Primitive: `txWrite(db, fn)` — runs `fn(tx)` against a
// transaction-scoped db handle and rolls back on throw. Returns the
// value returned by `fn` or re-throws the first error verbatim.
//
// Usage:
//
//   return txWrite(db, async (tx) => {
//     const [a] = await tx.insert(prescriptions).values(...).returning();
//     const [b] = await tx.insert(medicalRecords).values(...).returning();
//     return { prescription: a, record: b };
//   });
//
// If `fn` throws, both inserts are reverted. No partial state escapes.

export async function txWrite<T>(
  db: any,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  // Drizzle's `db.transaction` on D1 opens a SQLite transaction and
  // yields the tx-scoped driver to the callback. Throws inside the
  // callback trigger ROLLBACK automatically. Errors propagate
  // verbatim so callers can distinguish unique-violation from logic
  // errors.
  return db.transaction(async (tx: any) => {
    return fn(tx);
  });
}

/**
 * Convenience: catch unique-constraint collisions and return a
 * sentinel object so the route can decide whether to 409 or retry
 * with idempotency. Used by all the multi-write endpoints so a
 * retry from the client (network blip) doesn't double-insert.
 */
export class UniqueViolation extends Error {
  constructor(public readonly cause: any, msg = "Unique violation") {
    super(msg);
    this.name = "UniqueViolation";
  }
}

export function isUniqueViolation(err: any): boolean {
  if (!err) return false;
  const m = String(err?.message || "").toLowerCase();
  return (
    m.includes("unique") ||
    m.includes("constraint") ||
    m.includes("sqlite_busy") ||
    String(err?.code || "").startsWith("SQLITE_CONSTRAINT")
  );
}

/**
 * Run `fn` and translate any unique-violation into a UniqueViolation
 * with the original cause attached. Lets the route handler convert
 * a soft race (concurrent INSERT of the same natural key) into a
 * deterministic 409 Conflict.
 */
export async function txWriteUnique<T>(
  db: any,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  try {
    return await txWrite(db, fn);
  } catch (err: any) {
    if (isUniqueViolation(err)) throw new UniqueViolation(err);
    throw err;
  }
}
