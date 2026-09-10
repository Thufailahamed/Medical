# Lab Test Provider Registration + Listing — Design

Date: 2026-09-10
Status: approved

## Context

- Web lab onboarding: `apps/marketing/src/app/lab-portal/register/page.tsx` → `POST /auth/register {role: laboratory}`.
- Backend `registerSchema` strips extra fields; no `lab_profiles` table. License/accreditation/address/hours/bank lost. Admin approves blind.
- Mobile `register.tsx` supports only patient/doctor/hospital_staff — intentional (web-only lab onboarding).
- Lab portal catalog: `/lab-portal/diagnostic-tests-availability` + legacy `/lab-portal/catalog` — functional.
- Public catalog `GET /diagnostic-tests/catalog` returns `DiagnosticTestDTO {categorySlug, minPrice, availableAt[], laboratoryCount}`.
- Web patient `/patient/diagnostic-tests/page.tsx` expects old shape (`category`, `price`) and detail calls `/diagnostic-tests/catalog/:slug` (404; correct is `/diagnostic-tests/:slug`).
- Mobile `test-catalog.tsx` expects `category` + `c.count`, detail expects `{test, packages}`; backend returns flat DTO. Booking `POST /diagnostic-tests/book` derives `labPartnerId` from legacy catalog `labPartnerId` (nullable in 0076) — orphan bookings for global catalog tests.

Decisions: persist full profile; patient picks lab; web-only onboarding.

## Approaches considered

1. **Full profile table + DTO fixes + lab picker (Recommended)** — new `lab_profiles` table, extend register, fix web/mobile DTOs, add `labPartnerId` to book with validation. Correct, matches tenant pattern, needs migration.
2. **Reuse register-tenant for labs** — separate endpoint reusing hospital/clinic infra. Faster but conflates lab with facility roles and RBAC.
3. **Frontend-only fixes** — drop extra fields from UI, fix DTO display only. Fastest but loses verification data and leaves orphan bookings.

Chosen: Approach 1.

## Design

### A. Registration + profile

- New table `lab_profiles (user_id PK/FK users.id, lab_name, license_number UNIQUE, accreditation, address, city, operating_hours, bank_name, bank_account, created_at, updated_at)`.
- Extend `registerSchema` with optional `labProfile {licenseNumber, accreditation, address, city, operatingHours, bankName, bankAccount}`; require `licenseNumber+address` when `role==laboratory`.
- `POST /auth/register`: in same transaction create user (status pending) + `lab_profiles` row. Include `labProfile` in admin `account_pending_review` notification data. Return `requiresApproval:true`.
- Admin queue already filters `(status,role)`; ensure lab profile joined for display (no new admin UI needed if generic detail shows JSON; else add columns).
- Web register page unchanged (already sends fields) — map `licenseNumber->labProfile.licenseNumber` etc. Handle 202 pending UI (exists).

### B. Listing visibility (web + mobile)

- Web `diagnostic-tests/page.tsx`: switch to `categorySlug`, `minPrice`/`discountPrice`, `availableAt`, `laboratoryCount`; categories from `/diagnostic-tests/categories` (slug/name).
- Web `[slug]/page.tsx`: fix to `GET /diagnostic-tests/:slug`; render lab offers (`availableAt`) with radio picker.
- Mobile `useApi` types: `categorySlug`, `minPrice`; categories type `{slug,name}`; catalog screen filters by `categorySlug`, chips from categories list; detail screen reads flat DTO + `availableAt` picker.
- No new public endpoints; reuse existing catalog/packages.

### C. Booking with lab choice

- `POST /diagnostic-tests/book` accepts optional `labPartnerId`. If provided: validate active `lab_diagnostic_tests(labPartnerId,testId)` row, use its price. If omitted: pick cheapest active offer; if none and legacy `labPartnerId` present, use it; else 404 `No lab currently offers this test`.
- Package booking unchanged (single-lab packages).
- Web + mobile detail/booking forms add lab radio (default cheapest), pass `labPartnerId`.
- Error handling: 400 invalid lab, 404 no offer, 409 slot full (existing). Audit + notify unchanged.

### Testing

- API vitest: register-lab persists profile + pending; book with valid/invalid labId; catalog includes newly enabled lab offer.
- Web: existing vitest for diagnostic pages (update mocks to new DTO).
- Mobile: typecheck + manual catalog→detail→book flow.

## Risks

- Migration 0076+ assumes MockD1 parity — keep `lab_profiles` local-table pattern where needed for tests.
- Legacy `/lab-portal/catalog` creates catalog rows with `labPartnerId`; keep read path supporting both legacy price and `availableAt` minPrice.
