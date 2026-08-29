import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const MANIFEST = path.join(REPO_ROOT, "docs/parity-manifest.md");
const PATIENT_APP_DIR = path.join(
  REPO_ROOT,
  "apps/marketing/src/app/patient"
);

interface ParityRow {
  mobile: string;
  web: string;
  status: string;
  subProject: string;
  notes: string;
}

/** Parse the manifest's data rows, skipping the status-legend table. */
function parseManifest(markdown: string): ParityRow[] {
  return markdown
    .split("\n")
    .filter(
      (line) =>
        // Data rows: backticked mobile route OR the plain `push notifications` row.
        // The legend rows start with `| `done`` / `| `planned`` / `| `n-a-native``,
        // which we exclude by requiring the second cell to be a web route
        // (`/...`, `/portal/...`, or an em dash for n-a-native entries).
        line.startsWith("| `") ||
        line.startsWith("| push")
    )
    .filter((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().replace(/^`|`$/g, ""));
      return (
        cells.length >= 5 &&
        (cells[1].startsWith("/") || cells[1] === "—")
      );
    })
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().replace(/^`|`$/g, ""));
      return {
        mobile: cells[0],
        web: cells[1],
        status: cells[2],
        subProject: cells[3],
        notes: cells[4] ?? "",
      };
    });
}

/**
 * Resolve a served route to its page file, trying the `(app)` route group
 * first since every authenticated patient page lives there.
 */
function pageFileFor(webRoute: string): string | null {
  const rel = webRoute.replace(/^\/patient\/?/, "");
  const candidates = [
    path.join(PATIENT_APP_DIR, "(app)", rel, "page.tsx"),
    path.join(PATIENT_APP_DIR, rel, "page.tsx"),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

const rows = parseManifest(readFileSync(MANIFEST, "utf8"));

describe("parity manifest", () => {
  it("has rows", () => {
    expect(rows.length).toBeGreaterThan(50);
  });

  it("uses only known status values", () => {
    for (const row of rows) {
      expect(["done", "planned", "n-a-native"]).toContain(row.status);
    }
  });

  const doneRows = rows.filter(
    (r) => r.status === "done" && r.web.startsWith("/patient")
  );

  it.each(doneRows.map((r) => [r.mobile, r.web]))(
    "%s is marked done, so %s must resolve to a page file",
    (_mobile, web) => {
      expect(pageFileFor(web), `no page.tsx found for ${web}`).not.toBeNull();
    }
  );

  it("requires a reason for every n-a-native row", () => {
    for (const row of rows.filter((r) => r.status === "n-a-native")) {
      expect(row.notes.length, `${row.mobile} needs a reason`).toBeGreaterThan(0);
    }
  });

  it("has no planned rows left", () => {
    const planned = rows.filter((r) => r.status === "planned");
    expect(planned.map((r) => r.mobile)).toEqual([]);
  });

  it("behavioral markers: family lock, QR pages, bulk hooks, consents/dsar", () => {
    const familyPage = readFileSync(
      path.join(PATIENT_APP_DIR, "(app)/family/page.tsx"),
      "utf8",
    );
    expect(familyPage).toMatch(/useToggleFamilyLock/);
    expect(familyPage).toMatch(/useCreateFamilyInvite/);

    const emergencyPage = readFileSync(
      path.join(PATIENT_APP_DIR, "(app)/emergency/page.tsx"),
      "utf8",
    );
    expect(emergencyPage).toMatch(/qrcode/i);
    expect(emergencyPage).toMatch(/useEmergencyQR/);

    const healthIdPage = readFileSync(
      path.join(PATIENT_APP_DIR, "(app)/health-id/page.tsx"),
      "utf8",
    );
    expect(healthIdPage).toMatch(/encodeHealthIdPayload/);
    expect(healthIdPage).toMatch(/qrcode/i);

    const recordsPage = readFileSync(
      path.join(PATIENT_APP_DIR, "(app)/records/page.tsx"),
      "utf8",
    );
    expect(recordsPage).toMatch(/useBulkArchiveRecords/);
    expect(recordsPage).toMatch(/useRecordSearch/);

    const consentsPage = readFileSync(
      path.join(PATIENT_APP_DIR, "(app)/consents/page.tsx"),
      "utf8",
    );
    expect(consentsPage).toMatch(/useConsentsMine/);
    expect(consentsPage).toMatch(/useRevokeConsent/);

    const dsarPage = readFileSync(
      path.join(PATIENT_APP_DIR, "(app)/dsar/page.tsx"),
      "utf8",
    );
    expect(dsarPage).toMatch(/useDsarExport/);
    expect(dsarPage).toMatch(/useDsarJobs/);

    const recordForm = readFileSync(
      path.join(
        REPO_ROOT,
        "apps/marketing/src/patient/components/records/RecordForm.tsx",
      ),
      "utf8",
    );
    expect(recordForm).toMatch(/useFamilyMembers/);
  });
});
