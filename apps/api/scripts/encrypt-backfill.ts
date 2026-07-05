#!/usr/bin/env bun
// scripts/encrypt-backfill.ts
//
// Phase v3: One-shot worker that wraps every existing `medical_records`
// row (where `envelope_version IS NULL`) into an AES-256-GCM envelope.
// Idempotent: re-runs are safe.
//
// Usage:
//   bun scripts/encrypt-backfill.ts [--dry-run] [--batch=200]
//
// Requires:
//   RECORD_KEK_PRIMARY (or legacy DOCTOR_KEY_KEK) configured.
//   D1 binding available via the api worker's wrangler dev tunnel:
//     pnpm --filter api exec wrangler d1 migrations apply <DB>
//     pnpm --filter api exec wrangler dev --port 8787 --local
//   then run: bun scripts/encrypt-backfill.ts --base=http://localhost:8787
//
// For prod, schedule via Cron Trigger (post-deploy) and gate on
// `envelope_version IS NULL`.

import { webcrypto } from "node:crypto";
import {
  encryptEnvelope,
} from "../src/lib/envelope-crypto";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

interface Args {
  base: string;
  dryRun: boolean;
  batch: number;
  token: string | null;
  env: Record<string, string>;
}

function parseArgs(): Args {
  const out: Args = {
    base: process.env.BACKFILL_BASE ?? "http://localhost:8787",
    dryRun: process.argv.includes("--dry-run"),
    batch: 200,
    token: process.env.AUTH_TOKEN ?? null,
    env: {
      RECORD_KEK_PRIMARY: process.env.RECORD_KEK_PRIMARY ?? "",
      DOCTOR_KEY_KEK: process.env.DOCTOR_KEY_KEK ?? "",
    },
  };
  for (const arg of process.argv) {
    if (arg.startsWith("--batch=")) out.batch = Number(arg.slice(8)) || 200;
    if (arg.startsWith("--base=")) out.base = arg.slice(7);
  }
  return out;
}

interface Row {
  id: string;
  title: string | null;
  diagnosis: string | null;
  summary: string | null;
  notes: string | null;
  extractedData: string | null;
  tags: string | null;
  recordType: string;
  familyMemberId: string | null;
  recordDate: string | null;
}

async function fetchUnenveloped(args: Args): Promise<Row[]> {
  // The script reads via the API to keep auth + tenant scoping consistent.
  const headers: Record<string, string> = {};
  if (args.token) headers.Authorization = `Bearer ${args.token}`;
  const res = await fetch(`${args.base}/internal/medical-records/unenveloped?limit=${args.batch}`, {
    headers,
  });
  if (!res.ok) throw new Error(`Backfill fetch failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { items: Row[] };
  return body.items ?? [];
}

async function main() {
  const args = parseArgs();
  if (!args.env.RECORD_KEK_PRIMARY && !args.env.DOCTOR_KEY_KEK) {
    console.error(
      "FATAL: set RECORD_KEK_PRIMARY (preferred) or DOCTOR_KEY_KEK (legacy) — 32 bytes base64.",
    );
    process.exit(1);
  }
  console.log(
    `[backfill] dry-run=${args.dryRun} base=${args.base} batch=${args.batch} kek=${
      args.env.RECORD_KEK_PRIMARY ? "primary" : "legacy"
    }`,
  );

  let total = 0;
  let pages = 0;
  // Loop until the API returns fewer rows than batch.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await fetchUnenveloped(args);
    if (!rows.length) break;
    pages += 1;
    for (const row of rows) {
      const env = {
        kind: row.recordType,
        title: row.title ?? "",
        diagnosis: row.diagnosis ?? undefined,
        summary: row.summary ?? undefined,
        notes: row.notes ?? undefined,
        extractedData: row.extractedData ?? undefined,
        tags: row.tags ? safeParse(row.tags, []) : undefined,
        familyMemberId: row.familyMemberId ?? undefined,
        recordDate: row.recordDate ?? undefined,
      };
      const envRow = await encryptEnvelope(args.env as Record<string, unknown>, env);
      if (args.dryRun) {
        console.log(`[dry] ${row.id} → envelope_version=${envRow.envelopeVersion}`);
        continue;
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (args.token) headers.Authorization = `Bearer ${args.token}`;
      const res = await fetch(`${args.base}/internal/medical-records/${row.id}/envelope`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(envRow),
      });
      if (!res.ok) {
        console.error(`[fail] ${row.id} ${res.status} ${await res.text()}`);
      } else {
        total += 1;
      }
    }
    if (rows.length < args.batch) break;
    if (pages > 1000) {
      console.error("[abort] over 1000 pages — check loop logic");
      process.exit(2);
    }
  }
  console.log(`[done] ${total} rows enveloped (${pages} pages).`);
}

function safeParse<T>(s: string, fb: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fb;
  }
}

main().catch((err) => {
  console.error("[error]", err);
  process.exit(1);
});