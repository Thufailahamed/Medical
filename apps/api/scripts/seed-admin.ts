// @ts-nocheck
// Standalone seed script.
//
// Usage from the repo root:
//   ADMIN_EMAIL=admin@healthhub.local ADMIN_PASSWORD='YourP@ssw0rd' \
//     bun apps/api/scripts/seed-admin.ts
//
// The script imports the shared seed helper that backends also use, so
// the admin row produced here is byte-identical to one a runtime admin
// command would create.

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { seedAdmin } from "../src/lib/seed-admin";

async function main() {
  const url = process.env.DRIZZLE_URL ?? process.env.DB_URL;
  const authToken = process.env.DRIZZLE_AUTH_TOKEN ?? process.env.DB_TOKEN;
  if (!url) {
    console.error(
      "[seed-admin] Set DRIZZLE_URL (libsql/http URL) and DRIZZLE_AUTH_TOKEN " +
        "(when remote) — or run from inside the Workers shell which exposes process.env.DB.",
    );
    process.exit(1);
  }
  const client = createClient({ url, authToken });
  const db = drizzle(client);
  const out = await seedAdmin(db);
  console.log("[seed-admin] result:", out);
}

main().catch((err) => {
  console.error("[seed-admin] failed:", err);
  process.exit(1);
});