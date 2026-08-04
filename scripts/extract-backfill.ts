#!/usr/bin/env bun
//
// One-shot CLI runner for the structured-extraction backfill.
// Usage:
//   bun scripts/extract-backfill.ts              # default batch
//   bun scripts/extract-backfill.ts --dry-run     # list candidates, no AI calls
//   bun scripts/extract-backfill.ts --limit 5     # max 5 records
//   bun scripts/extract-backfill.ts --per-hour 10 # respect per-hour cap
//
// Reads EXTRACT_BACKFILL_ENABLED from the env (default true for this CLI
// — the cron path respects the env flag for prod safety).

import { runExtractBackfill } from "../apps/api/src/cron/extract-backfill";

async function main() {
  const args = new Set(process.argv.slice(2).map((a) => a.toLowerCase()));
  const dryRun = args.has("--dry-run");
  const limitIdx = process.argv.indexOf("--limit");
  const perHourIdx = process.argv.indexOf("--per-hour");
  const limit = limitIdx > -1 ? parseInt(process.argv[limitIdx + 1], 10) : undefined;
  const perHour = perHourIdx > -1 ? parseInt(process.argv[perHourIdx + 1], 10) : undefined;

  const env = (globalThis as any).process?.env ?? {};
  const db = (globalThis as any).process?.env?.DB ?? null;

  // The CLI requires a real D1 binding to run. Local dev: user is expected
  // to wire `DB` from `wrangler dev` or `.dev.vars`. We mock if missing.
  if (!env.DB) {
    console.error(
      "[extract-backfill] DB binding missing. Run via `wrangler dev` or set DB in env.",
    );
    process.exit(2);
  }

  console.log(
    `[extract-backfill] starting dryRun=${dryRun} limit=${limit ?? "default"} perHour=${perHour ?? "default"}`,
  );

  const result = await runExtractBackfill(env, { DB: env.DB, R2: env.R2, AI: env.AI }, {
    enabled: true,
    dryRun,
    limit,
    perHour,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) {
    console.error(`[extract-backfill] ${result.errors.length} errors.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[extract-backfill] fatal:", err);
  process.exit(1);
});
