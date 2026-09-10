# Lab Provider Registration + Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lab providers register with full profile on web, list services via availability, and patients book a chosen lab on web + mobile.

**Architecture:** Add `lab_profiles` table + migration, extend `POST /auth/register` to persist profile, extend `POST /diagnostic-tests/book` with `labPartnerId` validation + cheapest fallback, fix web/mobile DTOs to `categorySlug/minPrice/availableAt` and add lab picker.

**Tech Stack:** Hono + Drizzle SQLite/D1, Zod, Next.js lab-portal/patient, Expo React Native mobile, Vitest + MockD1.

## Global Constraints

- Additive migrations only (`CREATE TABLE IF NOT EXISTS`, no drops).
- Zod strips unknown keys — explicitly accept lab profile fields.
- Laboratory role requires admin approval (`registration.approvalRoles` includes laboratory).
- Lab onboarding stays web-only; mobile stays patient booking.
- Reuse existing catalog endpoints; no new public endpoints.

---

### Task 1: Lab profile storage + registration

**Files:**
- Modify: `packages/db/src/schema.ts` (append `lab_profiles`)
- Create: `apps/api/migrations/0080_lab_profiles.sql`
- Modify: `apps/api/src/lib/validators.ts:95-157` (registerSchema + labProfileSchema)
- Modify: `apps/api/src/routes/auth.ts:128-275` (persist profile + notify)
- Test: `apps/api/tests/lab-provider-registration.test.ts`

**Interfaces:**
- Consumes: `registerSchema`, `users` insert, `getApprovalRequiredRoles`.
- Produces: `lab_profiles` rows `{userId, labName, licenseNumber, accreditation, address, city, operatingHours, bankName, bankAccount}`; `POST /auth/register` accepts `{..., licenseNumber?, labProfile?}` and returns 202 `requiresApproval:true`.

- [ ] **Step 1: Write failing test for lab registration with profile**

```ts
// apps/api/tests/lab-provider-registration.test.ts
import { describe, it, expect } from "vitest";
import { buildTestApp, postJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import authRouter from "../src/routes/auth";
describe("lab provider registration", () => {
  it("persists lab_profiles and returns 202 pending", async () => {
    const db = new MockD1();
    db.seed("users", []);
    const app = await buildTestApp(db, null);
    app.route("/auth", authRouter);
    const res = await postJson(app, "/auth/register", { name: "City Diagnostics", email: "labx@example.com", phone: "0771234567", password: "password123", role: "laboratory", licenseNumber: "LAB-001", address: "Main St Colombo" });
    expect(res.status).toBe(202);
    const rows = (db as any).tables.labProfiles?.rows ?? (db as any).tables["lab_profiles"]?.rows ?? [];
    expect(rows.length).toBe(1);
    expect(rows[0].licenseNumber ?? rows[0].license_number).toBe("LAB-001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run apps/api/tests/lab-provider-registration.test.ts`
Expected: FAIL (404 table / 400 validation / 0 rows).

- [ ] **Step 3: Add lab_profiles schema + migration + validator + route**

```ts
// packages/db/src/schema.ts append:
export const labProfiles = sqliteTable("lab_profiles", { userId: text("user_id").primaryKey().references((): any => users.id, { onDelete: "cascade" }), labName: text("lab_name").notNull(), licenseNumber: text("license_number").notNull().unique(), accreditation: text("accreditation"), address: text("address").notNull(), city: text("city"), operatingHours: text("operating_hours"), bankName: text("bank_name"), bankAccount: text("bank_account"), createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(), updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull() });
```

```sql
-- apps/api/migrations/0080_lab_profiles.sql
CREATE TABLE IF NOT EXISTS lab_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, lab_name TEXT NOT NULL, license_number TEXT NOT NULL UNIQUE, accreditation TEXT, address TEXT NOT NULL, city TEXT, operating_hours TEXT, bank_name TEXT, bank_account TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL);
CREATE INDEX IF NOT EXISTS idx_lab_profiles_license ON lab_profiles(license_number);
```

```ts
// validators: accept flat + nested, require license+address for laboratory
export const labProfileSchema = z.object({ licenseNumber: z.string().min(2).max(64).optional(), accreditation: z.string().max(200).optional(), address: z.string().max(500).optional(), city: z.string().max(120).optional(), operatingHours: z.string().max(200).optional(), bankName: z.string().max(120).optional(), bankAccount: z.string().max(64).optional() });
// add to registerSchema: licenseNumber, accreditation, address, city, operatingHours, bankName, bankAccount flat + labProfile nested; refine: if role==laboratory require (labProfile?.licenseNumber ?? licenseNumber) and (labProfile?.address ?? address)
```

```ts
// auth.ts after user insert, if role==laboratory: resolve profile = {...flat, ...nested}, insert into labProfiles (best-effort try/catch so registration never 500s on profile), include licenseNumber in admin notification data
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run apps/api/tests/lab-provider-registration.test.ts apps/api/tests/auth.test.ts apps/api/tests/auth-approval.test.ts apps/api/tests/lab-onboarding.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts apps/api/migrations/0080_lab_profiles.sql apps/api/src/lib/validators.ts apps/api/src/routes/auth.ts apps/api/tests/lab-provider-registration.test.ts
git commit -m "feat(lab): persist lab provider profile on registration"
```

### Task 2: Booking with explicit lab choice

**Files:**
- Modify: `apps/api/src/lib/validators.ts:620-633` (testBookingSchema + labPartnerId)
- Modify: `apps/api/src/routes/diagnostic-tests.ts:726-895` (resolve lab from availability)
- Test: `apps/api/tests/lab-provider-booking.test.ts`

**Interfaces:**
- Consumes: `labDiagnosticTests` active rows, `diagnosticTestCatalog` row.
- Produces: `POST /diagnostic-tests/book` accepts `{..., labPartnerId?}`; validates active offer; falls back to cheapest offer; 404 when no offer.

- [ ] **Step 1: Write failing test for lab-specific booking**

```ts
import { describe, it, expect } from "vitest";
import { buildTestApp, postJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import diagRouter from "../src/routes/diagnostic-tests";
describe("lab-specific booking", () => {
  it("books cheapest offer when labPartnerId omitted and rejects unknown lab", async () => {
    const db = new MockD1();
    db.seed("users", [{ id: "lab-a", role: "laboratory", name: "A" }, { id: "pat-u", role: "patient", name: "P" }]);
    db.seed("patients", [{ id: "pat-1", userId: "pat-u" }]);
    db.seed("diagnostic_test_catalog", [{ id: "t-1", slug: "cbc", name: "CBC", category: "blood", sampleType: "blood", fastingRequired: false, fastingHours: 0, homeCollectionAvailable: true, price: 2000, discountPrice: null, labPartnerId: null, turnaroundHours: 24, isActive: true }]);
    db.seed("lab_diagnostic_tests", [{ id: "o-a", labPartnerId: "lab-a", testId: "t-1", price: 1800, discountPrice: null, currency: "LKR", homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true }]);
    const app = await buildTestApp(db, { id: "pat-u", role: "patient" });
    app.route("/diagnostic-tests", diagRouter);
    const bad = await postJson(app, "/diagnostic-tests/book", { bookingType: "single_test", testId: "t-1", labPartnerId: "lab-unknown", scheduledDate: "2099-01-01", scheduledTimeSlot: "morning", collectionAddress: { line1: "1 Main", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }, paymentMethod: "cash" });
    expect([400, 404]).toContain(bad.status);
    const ok = await postJson(app, "/diagnostic-tests/book", { bookingType: "single_test", testId: "t-1", scheduledDate: "2099-01-01", scheduledTimeSlot: "morning", collectionAddress: { line1: "1 Main", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }, paymentMethod: "cash" });
    expect(ok.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run apps/api/tests/lab-provider-booking.test.ts`
Expected: FAIL (unknown lab accepted / omitted lab orphans).

- [ ] **Step 3: Minimal implementation (schema + resolver)**

```ts
// validators testBookingSchema add: labPartnerId: z.string().min(1).max(80).optional()
// routes/diagnostic-tests.ts POST /book single_test branch:
// 1. load catalog test (existing)
// 2. load active labDiagnosticTests rows for testId
// 3. if data.labPartnerId: find row with labPartnerId; if missing → 404 {error:"Selected lab does not offer this test"}; price = discountPrice ?? price; labPartnerId = data.labPartnerId
// 4. else if rows.length: pick min(discountPrice ?? price); price + labPartnerId from winner
// 5. else fallback legacy test.labPartnerId (existing behaviour); if still empty → 404 {error:"No lab currently offers this test"}
// 6. also validate chosen offer homeCollectionAvailable (keep existing check against catalog OR offer)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run apps/api/tests/lab-provider-booking.test.ts apps/api/tests/diagnostic-tests.test.ts apps/api/tests/diagnostic-tests-catalog.test.ts apps/api/tests/lab-payments.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/validators.ts apps/api/src/routes/diagnostic-tests.ts apps/api/tests/lab-provider-booking.test.ts
git commit -m "feat(lab): support explicit lab selection when booking tests"
```

### Task 3: Web patient listing + detail + lab picker

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/diagnostic-tests/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/diagnostic-tests/[slug]/page.tsx`
- Modify: `apps/marketing/src/app/admin/(admin)/laboratories/page.tsx` (show license/address)
- Test: update mocks in `apps/marketing` diagnostic tests if present; `bunx tsc --noEmit` / vitest.

**Interfaces:**
- Consumes: `GET /diagnostic-tests/catalog`, `GET /diagnostic-tests/:slug`, `GET /diagnostic-tests/categories`.
- Produces: web cards show `minPrice` + `laboratoryCount`; detail shows `availableAt` radio + passes `labPartnerId` to `POST /diagnostic-tests/book`.

- [ ] **Step 1: Write failing check (detail URL + DTO)**

```ts
// manual: grep must show `/diagnostic-tests/${slug}` not `/diagnostic-tests/catalog/${slug}`, and `availableAt` + `minPrice` usage
```

- [ ] **Step 2: Run web typecheck to verify it fails**

Run: `bunx tsc --noEmit -p apps/marketing/tsconfig.json` (or `npm run typecheck` in app)
Expected: FAIL / missing lab picker.

- [ ] **Step 3: Minimal implementation**

```tsx
// page.tsx: type DiagnosticTest { id; slug; name; categorySlug: string|null; minPrice: number; discountPrice?: number|null; price?: number; laboratoryCount: number; availableAt?: any[]; ... } ; fetch `/diagnostic-tests/catalog?limit=50`; price = minPrice ?? discountPrice ?? price; filter by categorySlug
// [slug]/page.tsx: queryFn api(`/diagnostic-tests/${slug}`) → flat DTO; state selectedLab (default cheapest availableAt); book body includes labPartnerId: selectedLab ?? undefined; render lab radio list with labName + price + rating
// admin laboratories: extend Row with licenseNumber/address/city; render extra columns (fallback "—" when missing); fetch already includes users — join lab_profiles in admin API if available else tolerate missing
```

- [ ] **Step 4: Run web checks to verify they pass**

Run: `bunx tsc --noEmit -p apps/marketing/tsconfig.json` + relevant vitest
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/app/patient/\(app\)/diagnostic-tests/page.tsx apps/marketing/src/app/patient/\(app\)/diagnostic-tests/\[slug\]/page.tsx apps/marketing/src/app/admin/\(admin\)/laboratories/page.tsx
git commit -m "fix(web): lab catalog DTOs, detail route, and lab picker"
```

### Task 4: Mobile catalog + detail + lab picker

**Files:**
- Modify: `apps/mobile/src/hooks/useApi.ts:4184-4233` (DiagnosticTest + DiagnosticCategory types)
- Modify: `apps/mobile/src/app/(app)/test-catalog.tsx` (categorySlug, minPrice, chips)
- Modify: `apps/mobile/src/app/(app)/test-detail/[slug].tsx` (flat DTO, availableAt picker, pass labPartnerId)
- Modify: `apps/mobile/src/app/(app)/test-packages.tsx` + `test-package-detail/[slug].tsx` only if type errors (min touch)

**Interfaces:**
- Consumes: same catalog endpoints as Task 3.
- Produces: mobile cards show lab count + min price; detail books with `labPartnerId`.

- [ ] **Step 1: Write failing typecheck**

Run: `bunx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: FAIL on `category` / `count` / `test.packages`.

- [ ] **Step 2: Minimal implementation**

```ts
// useApi: DiagnosticTest { categorySlug: string|null; category?: string; minPrice: number; price: number; laboratoryCount: number; availableAt: LabAvailability[] } ; DiagnosticCategory { slug; name; } + compat { category?: string; count?: number }
// test-catalog: chips from categories (slug/name, count = items per slug or 0, show all); filter param category = selectedSlug; card price = minPrice ?? discountPrice ?? price; subtitle = laboratoryCount
// test-detail: const test = data; packages = []; selectedLab state default cheapest availableAt; Button passes labPartnerId; render Available labs section with Pressable radio rows
```

- [ ] **Step 3: Run mobile typecheck**

Run: `bunx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useApi.ts apps/mobile/src/app/\(app\)/test-catalog.tsx apps/mobile/src/app/\(app\)/test-detail/\[slug\].tsx
git commit -m "fix(mobile): lab catalog DTOs and lab picker"
```
