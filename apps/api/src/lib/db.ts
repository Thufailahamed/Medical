import { drizzle } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "@healthcare/db";

export function createDb(d1: D1Database) {
  const db = drizzle(d1, { schema });
  // Enable FK enforcement on this binding. SQLite leaves FKs off by
  // default and the pragma is per-connection, so run it once per
  // createDb() call (i.e. once per request). Fire-and-forget is safe:
  // drizzle queues the PRAGMA ahead of any subsequent statements on
  // the same handle.
  void db.run(sql`PRAGMA foreign_keys = ON`);
  return db;
}

export type DB = ReturnType<typeof createDb>;
