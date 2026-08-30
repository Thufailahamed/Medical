# Lab & Diagnostics — Foundation + Patient Booking Slice (Phases 1-6)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]` checkboxes.
>
> **Scope (user-approved):** Phase 1-6 of the 28-section spec — schema, seed, catalog API, lab availability, packages, patient browse+book. Phases 7-15 (doctor orders, lab order mgmt, results extraction, trends, admin, promo/ratings, notifications, analytics, sync polish) are explicitly out of this slice.

## Goal

Replace hardcoded `CURATED_PACKAGES` / `COMMON_TESTS` with a database-backed canonical diagnostic test catalog. Mobile + web patient experiences consume the same `/diagnostic-tests/*` APIs. One end-to-end patient booking flow works against `test_bookings`.

## Architecture

- **Source of truth = DB.** `diagnostic_test_catalog` (0062) is enriched; per-laboratory availability extends it without duplicating test definitions.
- **Per-lab availability** = new `lab_diagnostic_tests` join table (lab adds price, TAT, home/lab collection toggles, status). Catalog row stays canonical.
- **Packages** = `test_packages` + `test_package_items` (0062). Add `image_url`, `category`, `preparation`, `fasting_required`, `sample_type`, `popular`, `featured`.
- **Patient booking** = reuse existing `test_bookings` + `test_booking_items` (0062/0067) + payment integration in `routes/diagnostic-tests.ts`. Hardcoded `CURATED_PACKAGES_DATA` at `apps/api/src/routes/diagnostic-tests.ts:117` becomes DB fallback only — removed after seed verified.

## Tech Stack

Existing: Hono on Cloudflare Workers · D1 · Drizzle (`packages/db/src/schema.ts`) · Next.js 16 · Expo SDK 51 · Bun · vitest.

## Global Constraints

- Migration files numbered `0076_*.sql` and after. Latest = `0075_notification_push_status.sql`.
- Every new table: add to `packages/db/src/schema.ts` AND corresponding `apps/api/migrations/0076_*.sql` (manual, since Drizzle migrator not in use based on journal path).
- All new auth routes use `authMiddleware` then `requireRole(...)` from `apps/api/src/middleware/rbac.ts`.
- All new server-side mutations call `audit(db, ...)` from `apps/api/src/lib/audit.ts`.
- All user-facing strings go through trilingual i18n (`en`/`si`/`ta`).
- Mobile + web must hit same endpoints with no business-logic duplication.

## Existing Code Inventory — DO NOT duplicate

| Area | File | Reuse |
|---|---|---|
| Patient catalog/book/bookings API | `apps/api/src/routes/diagnostic-tests.ts` | Rewrite `/catalog`, `/packages`, `/packages/:slug`, `/book` to read DB. Keep auth + payment integration. |
| Lab portal catalog/packages/bookings | `apps/api/src/routes/lab-partner-portal.ts` | Extend `/catalog`, `/packages` to write to new lab_availability table. |
| Patient lab mobile screens | `apps/mobile/src/app/(app)/test-{catalog,packages,package-detail,detail,bookings,booking-detail,result,book-test}.tsx`, `index.tsx` | Swap `CURATED_PACKAGES` reads for API hook; keep screen shells. |
| Patient lab web screens | `apps/marketing/src/app/patient/(app)/diagnostic-tests/{page,[slug]/page,packages/page,packages/[slug]/page,bookings/*}/page.tsx` | Same swap. |
| Diagnostic catalog table | `apps/api/migrations/0062_diagnostic_test_catalog.sql`; Drizzle `packages/db/src/schema.ts:4471-4540` | Add columns (see Schema below). |
| Packages tables | `apps/api/migrations/0062`; Drizzle `:4552-4606` | Add columns (see Schema below). |
| Bookings tables | `apps/api/migrations/0062/0067`; Drizzle `:4610-4720` | No new columns. |
| Phlebotomists | `apps/api/migrations/0066_phlebotomists.sql` | Reuse for booking assignment. |
| Admin web | `apps/marketing/src/app/admin/(admin)/{laboratories,insurances,…}/` | Add `laboratories/[id]/tests`, `diagnostics/{tests,packages,categories}/` routes. |
| Auth/RBAC | `apps/api/src/middleware/{auth.ts:15,rbac.ts:4,admin.ts}` | Reuse. |
| Notifications | `apps/api/src/lib/notifications.ts:42 notify()` | Use for booking-confirmed event. |
| Payments | `apps/api/src/routes/payments.ts:422 /checkout`, `:471 /diagnostic-tests` flow | Reuse existing `test_bookings` payment integration. |
| Audit | `apps/api/src/lib/audit.ts` | Reuse `audit(db, AuditInput)`. |
| Doctor lab orders (out of slice) | `apps/api/src/routes/doctor-portal.ts:1562,1679,1733` + `apps/marketing/src/portal/components/labs/LabOrderForm.tsx:21` `COMMON_TESTS` + `apps/mobile/src/app/(doctor)/lab-order.tsx:22` `COMMON_TESTS` | Leave untouched this slice. |
| Lab report extraction pipeline (out of slice) | `apps/api/migrations/0070_structured_extraction.sql`; `lib/extraction-pipeline.ts` | Leave untouched. |

## Phase 1 — Schema (migration `0076_lab_diagnostics_v2.sql`)

- [ ] New table **`lab_diagnostic_test_categories`**(`id PK`, `slug UNIQUE`, `name`, `name_si`, `name_ta`, `icon`, `display_order`, `is_active`, `created_at`).
- [ ] Enrich **`diagnostic_test_catalog`** columns: `short_name`, `code`, `result_interpretation`, `reference_info`, `currency`, `visibility` (CHECK `public`/`internal`), `is_bookable`, `is_doctor_orderable`, `lab_collection_available`, `display_order`, `synonyms` (JSON text). Backfill `category_id` FK → `lab_diagnostic_test_categories(id)`. `lab_partner_id` becomes nullable (catalog is global; per-lab config in join table).
- [ ] New table **`lab_diagnostic_tests`** (per-laboratory availability): `id PK`, `lab_partner_id FK→users(id)`, `test_id FK→diagnostic_test_catalog(id)`, `price REAL NOT NULL`, `discount_price REAL`, `currency`, `home_collection_available`, `lab_collection_available`, `turnaround_hours`, `special_instructions`, `is_active`, `created_at`, `updated_at`. UNIQUE `(lab_partner_id, test_id)`. INDEX `(test_id, is_active)`, `(lab_partner_id, is_active)`.
- [ ] Enrich **`test_packages`** columns: `category_id`, `category` text (kept for backward compat from 0062), `preparation`, `fasting_required`, `sample_type`, `image_url`, `popular` boolean, `featured` boolean, `display_order`, `currency`, `discount_percent` real (computed from `discount_price` vs sum of tests).
- [ ] New table **`test_package_images`** (optional multi-image per package): `id PK`, `package_id FK`, `image_url`, `display_order`, `created_at`. (Lets admin swap banner image.)
- [ ] Drizzle `packages/db/src/schema.ts`: add tables/columns above; export new types.
- [ ] Backfill: `ALTER TABLE diagnostic_test_catalog ADD COLUMN category_id` nullable; populate from existing `category` text via one-shot mapping in seed step.

## Phase 2 — Seed (`apps/api/scripts/seed-diagnostics.ts` + migration `0077_seed_diagnostic_catalog.sql`)

- [ ] Insert ~15 categories (Cardiology, Diabetes, Liver, Kidney, Thyroid, Lipid, CBC/Hematology, Urinalysis, Hormones, Vitamins, Imaging-Lab, Pregnancy, Cancer Screening, Allergy, Infectious Disease).
- [ ] Insert ≥40 canonical tests (CBC, Lipid Profile, Fasting Glucose, HbA1c, TSH, T3, T4, LFT, KFT, Electrolytes, Vitamin D, B12, Iron Studies, Urine FEME, etc.) with code + synonyms + preparation + sample type + reference range hints + result interpretation.
- [ ] Insert ≥5 packages matching existing slugs (`full-body-health-checkup`, `senior-citizen-wellness`, `cardiac-wellness-profile`, `comprehensive-diabetic-screen`, `essential-health-checkup`) and ≥3 new packages.
- [ ] For each test: derive `slug` from name (kebab-case, UNIQUE).
- [ ] Per-lab availability: pick first 5 laboratory-role users (any active user with role `laboratory`); assign each to ≥30 tests at catalogue-or-discount price.
- [ ] Package images: download from `urls.json` OSS links (the 9 lab/insurance asset entries) into `apps/marketing/public/assets/lab/packages/{slug}.jpg`. Persist URLs to `test_packages.image_url`.
- [ ] Idempotent UPSERT pattern (CHECK on slug + ON CONFLICT update). Wire as `bun run seed:diagnostics`.
- [ ] Side-effect: `urls.json` stays as asset source-of-truth for one-time image ingestion.

## Phase 3 — Catalog API (rewrite `apps/api/src/routes/diagnostic-tests.ts`)

- [ ] `GET /diagnostic-tests/categories` — public, ordered.
- [ ] `GET /diagnostic-tests/catalog` — public; filters: `q` (name/code/synonym), `category`, `is_bookable`, `home_collection`, `sample_type`, `min_price`, `max_price`, `sort=price|popular|name`, `cursor`, `limit`. Joins `lab_diagnostic_tests` for current `price` (lowest active) and laboratory count.
- [ ] `GET /diagnostic-tests/:slug` — public; returns canonical test + list of `available_at: [{lab_id, lab_name, price, discount_price, home_collection, lab_collection, turnaround_hours}]`.
- [ ] `GET /diagnostic-tests/catalog/search` — alias `/catalog?q=` for shared search box.
- [ ] Remove `CURATED_PACKAGES_DATA` fallback (apps/api/src/routes/diagnostic-tests.ts:117) once seed verified.
- [ ] DTO typing in `packages/shared/src/diagnostics.ts`.

## Phase 4 — Laboratory Availability API (extend `apps/api/src/routes/lab-partner-portal.ts`)

- [ ] `GET /lab-portal/catalog` — list current lab's enabled tests via `lab_diagnostic_tests` join.
- [ ] `POST /lab-portal/catalog` — lab enables a canonical test; sets price, TAT, collection toggles.
- [ ] `PUT /lab-portal/catalog/:testId` — update price/availability.
- [ ] `DELETE /lab-portal/catalog/:testId` — deactivate (soft).
- [ ] `POST /lab-portal/catalog/bulk-toggle` — bulk enable/disable from canonical list.
- [ ] All routes gated `requireRole("laboratory","super_admin")`; all writes call `audit(db, ...)`.

## Phase 5 — Packages API (rewrite `/diagnostic-tests/packages` + admin)

- [ ] `GET /diagnostic-tests/packages` — public; filters: `q`, `category`, `featured`, `popular`, `min_price`, `max_price`. Includes test count, savings %, includes tests summary.
- [ ] `GET /diagnostic-tests/packages/:slug` — public; returns package + ordered `tests: [...]` from `test_package_items`.
- [ ] Lab portal: `POST/PUT/DELETE /lab-portal/packages` already in place; ensure image upload via `POST /lab-portal/packages/:id/image` (multipart → R2 / OSS, mirrors insurance operator image flow at `apps/api/src/routes/insurance-operator.ts` image upload pattern).
- [ ] Admin: `POST /admin/diagnostics/packages` — super_admin can author global packages. `POST /admin/diagnostics/packages/:id/image` (multipart upload).

## Phase 6 — Patient Browse + Booking

- [ ] Mobile hook `apps/mobile/src/lib/api/diagnostics.ts` exposing `useCategories()`, `useCatalog(filters)`, `useTestBySlug(slug)`, `usePackages(filters)`, `usePackageBySlug(slug)`.
- [ ] Web hook `apps/marketing/src/lib/diagnostics.ts` (same shapes, fetch-based).
- [ ] Replace `CURATED_PACKAGES` reads in:
  - `apps/mobile/src/app/(app)/test-packages.tsx:130` → API
  - `apps/mobile/src/app/(app)/test-package-detail/[slug].tsx:18` → API
  - `apps/mobile/src/app/(app)/test-catalog.tsx:41` → API
  - `apps/mobile/src/app/(app)/index.tsx:73` (home shortcuts) → featured API
  - `apps/marketing/src/app/patient/(app)/diagnostic-tests/page.tsx:61,283` → API
  - `apps/marketing/src/app/patient/(app)/diagnostic-tests/packages/[slug]/page.tsx:44,209` → API
- [ ] Remove `package-assets.ts` import in `apps/mobile/src/app/(app)/test-packages.tsx:37`; image served from `image_url`.
- [ ] Mobile booking flow (`test-package-detail/[slug].tsx` → `book-test.tsx`) reads `available_at` for lab picker; respects existing time-slot logic in `GET /diagnostic-tests/time-slots`.
- [ ] Web booking flow mirrors in `diagnostic-tests/packages/[slug]/page.tsx` → `bookings/new/page.tsx`.
- [ ] All bookings use existing `POST /diagnostic-tests/book`; server re-computes price from DB, ignores client-supplied amount.
- [ ] `audit(db, ...)` for booking created; `notify(...)` "booking_confirmed" event via `lib/notifications.ts`.

## File Structure (planned)

**Created:**
- `apps/api/migrations/0076_lab_diagnostics_v2.sql`
- `apps/api/migrations/0077_seed_diagnostic_catalog.sql` (no — keep idempotent in `scripts/seed-diagnostics.ts`; this SQL file optional)
- `apps/api/scripts/seed-diagnostics.ts`
- `packages/shared/src/diagnostics.ts` (DTO types + zod schemas)
- `apps/api/src/routes/admin-diagnostics.ts` (mount at `/admin/diagnostics`)
- `apps/api/src/lib/diagnostics/{categories,availability,packages,bookings}.ts` (pure service layer)
- `apps/api/tests/diagnostics/{catalog,availability,packages,booking-flow,seed}.test.ts`
- `apps/mobile/src/lib/api/diagnostics.ts`
- `apps/marketing/src/lib/diagnostics.ts`
- `apps/marketing/src/app/admin/(admin)/diagnostics/{tests,packages,categories,laboratories}/` pages
- `docs/superpowers/plans/2026-08-31-lab-diagnostics-foundation.md` (this file)

**Modified:**
- `apps/api/src/routes/diagnostic-tests.ts` (rewrite, remove CURATED_PACKAGES_DATA fallback)
- `apps/api/src/routes/lab-partner-portal.ts` (extend catalog/packages with image upload)
- `apps/api/src/index.ts` (mount `/admin/diagnostics`)
- `packages/db/src/schema.ts` (new tables + enrichment columns on `diagnostic_test_catalog`, `test_packages`)
- `apps/mobile/src/app/(app)/{index,test-packages,test-package-detail/[slug],test-catalog,test-detail/[slug],book-test,test-bookings,test-booking-detail/[id]}.tsx` (swap CURATED_PACKAGES for API; lift testPackages.tsx category helper into shared utils)
- `apps/marketing/src/app/patient/(app)/diagnostic-tests/{page,[slug]/page,packages/page,packages/[slug]/page,bookings/new/page}.tsx` (same)
- `apps/mobile/src/constants/package-assets.ts` → mark deprecated, replace with API-driven images (or delete after migration verified)
- `urls.json` consumed by seed script (not deleted; one-shot asset source)
- `package.json` root (add `seed:diagnostics` script)

## Out of Scope (explicit)

- Doctor `COMMON_TESTS` picker (Phase 7) — `apps/mobile/src/app/(doctor)/lab-order.tsx:22`, `apps/marketing/src/portal/components/labs/LabOrderForm.tsx:21`.
- Doctor `lab_orders` schema enrichment (doctor-side) (Phase 7).
- Lab order management workflow in lab portal (Phase 8) — `routes/lab-partner-portal.ts:bookings/:id/*` endpoints already exist; this slice touches catalog/packages only.
- Result extraction pipeline changes / normalization against canonical catalog (Phase 9) — `migrations/0070`, `lib/extraction-pipeline.ts` untouched.
- Trends (Phase 10), Admin full mgmt (Phase 11), Promo/Ratings (Phase 12), Notifications beyond booking-confirmed (Phase 13), Analytics (Phase 14), Sync+UX polish (Phase 15).

## Acceptance Criteria (this slice only)

- [ ] Migration applies cleanly on a D1 DB with all prior 75 migrations; rollback is SQL DROP statements.
- [ ] `bun run seed:diagnostics` is idempotent and produces ≥40 canonical tests + ≥5 packages + per-lab availability for first 5 labs.
- [ ] `GET /diagnostic-tests/catalog` works without any client hardcoded data; `CURATED_PACKAGES_DATA` constant deleted.
- [ ] Mobile `test-catalog.tsx` and web `diagnostic-tests/page.tsx` render the same 40+ tests from the API.
- [ ] A patient can complete a booking end-to-end from package detail → lab picker → time slot → payment → booking confirmation; the booking lands in `test_bookings` with line items in `test_booking_items`.
- [ ] Existing `apps/api` vitest suite passes; `bun run typecheck` passes for all 4 packages.
- [ ] Mobile `bun run lint` + `bun run typecheck`; marketing `bun run typecheck` pass.
- [ ] No patient data leaks across lab/patient boundaries (test lab_ids opaque to other patients).
- [ ] `audit` records created for: catalog toggle, package CRUD, booking created.

## Risk Notes

- Schema changes to `diagnostic_test_catalog` (making `lab_partner_id` nullable) need data backfill — any existing rows must be migrated to `lab_diagnostic_tests` join rows in the same migration.
- Removing `CURATED_PACKAGES_DATA` while seed runs is order-dependent: deploy DB migration + seed before shipping client update that expects the API to populate the screens.
- Drizzle migration generation is not in use here; SQL must be hand-written and applied via `wrangler d1 execute` (matches existing ops pattern in repo).
