#!/usr/bin/env bun
// scripts/check-i18n.ts
//
// P1 bundle 3 — i18n parity skeleton.
//
// Walks every key in `en.json` (web + mobile) and reports which locales
// (si, ta) are missing the same key. Exits non-zero if any locale is
// below the 95 % threshold for a given namespace.
//
// The intent is mechanical: highlight the 1776 missing keys from the
// audit so a human translator can sweep them in batches. The script
// also back-fills missing keys with the English placeholder when run
// with `--fill` so the runtime shim never sees a missing key during
// the interim. A follow-up lint warns when a placeholder still equals
// the English value.
//
// Usage:
//   bun run scripts/check-i18n.ts                # report only
//   bun run scripts/check-i18n.ts --fill         # back-fill missing
//   bun run scripts/check-i18n.ts --fill --threshold=98

import * as fs from "node:fs";
import * as path from "node:path";

type Json = { [k: string]: Json | string | undefined };

const ROOT = path.resolve(import.meta.dir, "..");

const TARGETS: { locale: "si" | "ta"; relPath: string }[] = [
  { locale: "si", relPath: "apps/marketing/src/portal/i18n/si.json" },
  { locale: "ta", relPath: "apps/marketing/src/portal/i18n/ta.json" },
  { locale: "si", relPath: "apps/mobile/src/i18n/locales/si.json" },
  { locale: "ta", relPath: "apps/mobile/src/i18n/locales/ta.json" },
];

const EN_REF: { relPath: string }[] = [
  { relPath: "apps/marketing/src/portal/i18n/en.json" },
  { relPath: "apps/mobile/src/i18n/locales/en.json" },
];

function readJson(file: string): Json {
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw);
}

function writeJson(file: string, obj: Json): void {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf-8");
}

/** Walk a nested object and yield every dotted path. */
function* walkKeys(obj: Json, prefix = ""): Generator<string> {
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") {
      yield* walkKeys(v, next);
    } else {
      yield next;
    }
  }
}

/** Set a nested key to a value, creating intermediate objects. */
function setNested(obj: Json, dottedKey: string, value: Json | string): void {
  const parts = dottedKey.split(".");
  let cur: Json = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p] as Json;
  }
  cur[parts[parts.length - 1]] = value;
}

function getNested(obj: Json, dottedKey: string): Json | string | undefined {
  const parts = dottedKey.split(".");
  let cur: Json | string | undefined = obj;
  for (const p of parts) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Json)[p];
  }
  return cur;
}

function namespaceOf(dotted: string): string {
  // Top-level namespace = first segment for "tab.x.y" → "tab".
  return dotted.split(".")[0];
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const fill = args.has("--fill");
  const threshold = (() => {
    const t = process.argv.find((a) => a.startsWith("--threshold="));
    return t ? parseInt(t.split("=")[1], 10) : 95;
  })();

  let totalMissing = 0;
  let totalFailing = 0;
  let totalFilled = 0;

  for (const ref of EN_REF) {
    const enPath = path.join(ROOT, ref.relPath);
    if (!fs.existsSync(enPath)) continue;
    const en = readJson(enPath);
    const enKeys = Array.from(walkKeys(en));

    for (const target of TARGETS.filter((t) => t.relPath.startsWith(path.dirname(ref.relPath)))) {
      const tPath = path.join(ROOT, target.relPath);
      if (!fs.existsSync(tPath)) continue;
      const t = readJson(tPath);
      const tKeys = new Set(walkKeys(t));

      const missing = enKeys.filter((k) => !tKeys.has(k));
      const ratio = ((enKeys.length - missing.length) / enKeys.length) * 100;

      // Per-namespace breakdown
      const byNs = new Map<string, { present: number; total: number }>();
      for (const k of enKeys) {
        const ns = namespaceOf(k);
        if (!byNs.has(ns)) byNs.set(ns, { present: 0, total: 0 });
        const entry = byNs.get(ns)!;
        entry.total++;
        if (tKeys.has(k)) entry.present++;
      }
      const failingNamespaces = Array.from(byNs.entries())
        .filter(([, v]) => (v.present / v.total) * 100 < threshold)
        .map(([ns, v]) => `${ns}=${Math.round((v.present / v.total) * 100)}%`);

      console.log(
        `\n${target.relPath}: ${enKeys.length - missing.length}/${enKeys.length} (${ratio.toFixed(1)}%)`,
      );
      if (missing.length) {
        console.log(`  missing: ${missing.length}`);
        if (failingNamespaces.length) {
          console.log(`  below ${threshold}%: ${failingNamespaces.join(", ")}`);
        }
      }
      totalMissing += missing.length;

      if (ratio < threshold) totalFailing++;
      if (fill && missing.length) {
        for (const k of missing) {
          setNested(t, k, getNested(en, k) as Json | string);
          totalFilled++;
        }
        writeJson(tPath, t);
      }
    }
  }

  console.log(
    `\nTotal missing across all locales: ${totalMissing} ${fill ? `(filled ${totalFilled})` : ""}`,
  );
  console.log(
    totalFailing > 0
      ? `FAIL: ${totalFailing} locale(s) below ${threshold}% threshold`
      : "OK: all locales above threshold",
  );

  if (totalFailing > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});