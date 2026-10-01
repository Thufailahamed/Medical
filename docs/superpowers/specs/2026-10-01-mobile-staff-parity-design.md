# Mobile Staff-Roles Parity Design (web → mobile, DICOM excluded)

Reverse of `docs/parity-manifest.md`: brings mobile (`apps/mobile`) up to web
(`apps/marketing`) for 6 areas. Backend (`apps/api`) already exposes all
endpoints; this is UI-only. Approved section-by-section 2026-10-01.

## 1. Architecture / routing

- New route groups mirroring existing `(doctor)` / `(admin)` pattern, each with
  `_layout.tsx` using `IslandTabBar` from `src/components/ui/FloatingTabBar.tsx`:
  `(pharmacist)`, `(lab)`, `(operator)`.
- Extend `homeForRole` / `groupForRole` in `src/hooks/useProtectedRoute.ts`:
  `pharmacy` → `/(pharmacist)`, `laboratory` → `/(lab)`,
  `insurance_operator` (verify exact backend role string before coding) →
  `/(operator)`. `admin` / `super_admin` keep `/(admin)`.
- `(auth)/register.tsx`: add the 3 roles to role picker (check backend
  `/auth/register` accepted roles first).
- Auth, `lib/api.ts` Bearer + headers, `stores/auth.ts`: reused unchanged.
- Camera: `expo-camera` (verify installed; if missing, add dep + config-plugin)
  behind permission gate; manual patient-ID/token entry always available as
  fallback. Note: camera needs dev-build/EAS, not Expo Go.
- Out of scope: DICOM viewer, hospital native portal (stays
  `HospitalWebRedirect`), marketing pages.

## 2. Slice 1 — no new roles, no native deps

- `(app)/consents.tsx`: purpose list (`care_coordination`, `second_opinion`,
  `insurance_claim`, `research`, `other`) + duration presets (7/30/90/365d) +
  active-consents list with revoke + audit trail. Endpoints: `POST /consents/`,
  `DELETE /consents/:id`, `GET /consents/me|audit`. Mirror of web
  `patient/(app)/consents/page.tsx`. Link from profile/more hub.
- `insurance/payment/return.tsx` + `cancel.tsx`: deep-link/callback handlers;
  poll `GET /insurance-marketplace/enrollments/:id` (or existing enrollment
  query) then route to policy detail / marketplace. Mirror of web
  `insurance/payment/{return,cancel}/`.
- `(doctor)/walk-ins.tsx`: status filters
  (waiting/in-consultation/completed/no-show/all), register walk-in via patient
  search + `POST /walk-ins/`, `PATCH /walk-ins/:id` transitions,
  promote-to-queue. Mirror of web `portal/(portal)/walk-ins/page.tsx` (732
  lines — port simplified: list + register + status, keep search).

## 3. Slice 2 — pharmacist group

- `(pharmacist)/` tabs: queue = `index.tsx` (filter pills
  signed/dispensed/cancelled/all, default `signed`; `GET
  /pharmacy/prescriptions`), `prescription-detail.tsx` (Rx lines +
  Dispense/Reject → `POST /pharmacy/prescriptions/:id/{dispense,reject}`),
  `scan.tsx` (QR → `?patient=<id>&via=<token>` semantics, `via` forwarded to
  dispense mutation for `dispensed_via_qr` audit; manual-ID fallback).
- Mirror of web `portal/(portal)/pharmacy/page.tsx` + `pharmacy/[id]` +
  `scan/`. Reuse doctor Rx row + tone patterns.

## 4. Slice 3 — lab + operator groups

- `(lab)/` tabs: dashboard (`GET /lab-portal/stats`), bookings +
  `bookings/[id]` (`PATCH /lab-portal/bookings/:id/{confirm,assign-phlebotomist,en-route,collect-sample,in-progress,complete,cancel}`),
  catalog + packages CRUD (`/lab-portal/{catalog,packages}`). Mirror of web
  `lab-portal/(portal)/`.
- `(operator)/` tabs: dashboard, claims + `claims/[id]` (approve/reject/pay),
  enrollments. Mirror of web `insurance-operator/(portal)/`.

## 5. Cross-cutting

- i18n: `src/i18n/locales/{en,si,ta}.json` via targeted text insert only
  (JSON round-trip reformats unrelated lines — forbidden per AGENTS.md).
- Hooks: extend `src/hooks/useApi.ts` in existing style with role-prefixed
  query keys (`pharmacy*`, `labPortal*`, `operator*`, `consents*`, `walkIns*`).
- Styling: tokens via `useTheme()` (`src/constants/theme.ts`), `shadow.*`
  tokens (no CSS `boxShadow`), `Card`/`ListCard`/`SectionHeader` primitives,
  `colors.hairline` edges.
- Verification per slice: `cd apps/mobile && npx tsc --noEmit`, filter
  `TS2786`, compare only touched files; smoke-navigate each new screen.
