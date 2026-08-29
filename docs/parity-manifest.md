# Mobile ↔ Web Patient Parity Manifest

Single source of truth for how far the web patient portal has caught up with
the Expo app. Enforced by `apps/marketing/src/patient/parity.test.ts`: every
row marked `done` must resolve to a real page file under
`apps/marketing/src/app/patient/`.

**Status values**

| Status | Meaning |
|---|---|
| `done` | Reachable on web with equivalent capabilities. Must resolve to a page file. |
| `planned` | Not yet built. `sub-project` says which one owns it. |
| `n-a-native` | Will not be built. `notes` must say why. |

**Web route** is the route as served, e.g. `/patient/records`. The test maps
it to `apps/marketing/src/app/patient/(app)/records/page.tsx`, trying both
the `(app)` route group and the bare path.

| mobile | web | status | sub-project | notes |
|---|---|---|---|---|
| `(app)/index` | `/patient` | done | 0 | |
| `(app)/records` | `/patient/records` | done | 0 | list only; write-path in 2 |
| `(app)/record-detail` | `/patient/records/[id]` | done | 2 | actions bar (edit/archive/restore/move/re-extract/delete) + attachments + structured children |
| `(app)/add-record` | `/patient/records/new` | done | 2 | envelope-create; attachments added on detail |
| `(app)/edit-record` | `/patient/records/[id]/edit` | done | 2 | edit metadata + tags; delete inline |
| `(app)/records/scan` | `/patient/records/scan` | done | 6 | OCR via file upload |
| `(app)/records/trends` | `/patient/trends` | done | 0 | |
| `(app)/timeline` | `/patient/timeline` | done | 9 | |
| `(app)/notes` | `/patient/notes` | done | 0 | |
| `(app)/allergies` | `/patient/allergies` | done | 0 | |
| `(app)/vitals` | `/patient/vitals` | done | 0 | |
| `(app)/vaccinations` | `/patient/vaccinations` | done | 0 | |
| `(app)/health-summary` | `/patient/health` | done | 0 | |
| `(app)/medicines` | `/patient/medications` | done | 0 | dose actions only; add/edit in 3 |
| `(app)/add-medicine` | `/patient/medications/new` | done | 3 | |
| `(app)/edit-medicine` | `/patient/medications/[id]/edit` | done | 3 | |
| `(app)/medicines-history` | `/patient/medications/history` | done | 3 | |
| `(app)/refill` | `/patient/medications` | done | 0 | refill-due sheet on the medications page |
| `(app)/prescriptions` | `/patient/prescriptions` | done | 3 | |
| `(app)/prescription-detail` | `/patient/prescriptions/[id]` | done | 3 | |
| `(app)/verify/[id]` | `/portal/verify/[id]` | done | 1 | Public route, ungated; mobile's verify is login-gated and separate |
| `(app)/appointments` | `/patient/appointments` | done | 0 | |
| `(app)/appointment-detail` | `/patient/appointments/[id]` | done | 0 | |
| `(app)/book-appointment` | `/patient/appointments/book` | done | 4 | |
| `(app)/rate-visit/[appointmentId]` | `/patient/appointments/[id]/rate` | done | 4 | |
| `(app)/doctor/[id]` | `/patient/doctors/[id]` | done | 4 | |
| `(app)/teleconsult/[roomId]` | `/patient/teleconsult/[roomId]` | done | 4 | consolidated under /patient |
| `(app)/inbox` | `/patient/messages` | done | 0 | |
| `(app)/inbox/[id]` | `/patient/messages/[id]` | done | 0 | |
| `(app)/notifications` | `/patient/notifications` | done | 0 | |
| `(app)/notification-preferences` | `/patient/notifications/preferences` | done | 8 | |
| `(app)/profile` | `/patient/profile` | done | 0 | read-only; editing in 5 |
| `(app)/edit-profile` | `/patient/profile/edit` | done | 5 | |
| `(app)/appearance` | `/patient/settings/appearance` | done | 5 | |
| `(app)/change-password` | `/patient/settings/password` | done | 5 | |
| `(app)/support` | `/patient/support` | done | 5 | |
| `(app)/email-import` | `/patient/settings/email-import` | done | 5 | |
| `(app)/app-lock` | — | n-a-native | — | No browser SecureStore equivalent; session expiry covers it |
| `(app)/share` | `/patient/share` | done | 0 | |
| `(app)/export` | `/patient/export` | done | 0 | |
| `(app)/audit` | `/patient/audit` | done | 0 | |
| `(app)/activity` | `/patient/activity` | done | 9 | |
| `(app)/emergency` | `/patient/emergency` | done | 0 | |
| `(app)/health-id` | `/patient/health-id` | done | 0 | |
| `(app)/ai/chat` | `/patient/ai/chat` | done | 6 | |
| `(app)/ai/summary` | `/patient/ai` | done | 0 | |
| `(app)/ai/drug-check` | `/patient/ai` | done | 0 | |
| `(app)/ai/lab-explain` | `/patient/ai/lab-explain` | done | 6 | |
| `(app)/ai/lab-trend` | `/patient/ai/lab-trend` | done | 6 | |
| `(app)/ai/clinical-note` | `/patient/ai/clinical-note` | done | 6 | |
| `(app)/ai/ocr` | `/patient/ai/ocr` | done | 6 | file upload, not camera |
| `(app)/ai/vaccination-card` | `/patient/ai/vaccination-card` | done | 6 | file upload, not camera |
| `(app)/test-catalog` | `/patient/diagnostic-tests` | done | 0 | |
| `(app)/test-detail/[slug]` | `/patient/diagnostic-tests/[slug]` | done | 0 | |
| `(app)/test-packages` | `/patient/diagnostic-tests/packages` | done | 7 | |
| `(app)/test-package-detail/[slug]` | `/patient/diagnostic-tests/packages/[slug]` | done | 7 | |
| `(app)/book-test` | `/patient/diagnostic-tests/[slug]` | done | 0 | booking form on the detail page |
| `(app)/test-bookings` | `/patient/diagnostic-tests/bookings` | done | 7 | |
| `(app)/test-booking-detail/[id]` | `/patient/diagnostic-tests/bookings/[id]` | done | 7 | |
| `(app)/test-result/[bookingId]` | `/patient/diagnostic-tests/bookings/[id]/result` | done | 7 | |
| `(app)/rate-test/[bookingId]` | `/patient/diagnostic-tests/bookings/[id]/rate` | done | 7 | |
| `(app)/insurance/index` | `/patient/insurance` | done | 1 | |
| `(app)/insurance/marketplace` | `/patient/insurance/marketplace` | done | 1 | consolidate under /patient |
| `(app)/insurance/marketplace/[providerId]` | `/patient/insurance/marketplace/[providerId]` | done | 1 | |
| `(app)/insurance/plans/[planId]` | `/patient/insurance/plans/[planId]` | done | 1 | |
| `(app)/insurance/quote` | `/patient/insurance/quote` | done | 1 | |
| `(app)/insurance/enroll/[planId]` | `/patient/insurance/enroll/[planId]` | done | 1 | |
| `(app)/insurance/payment/[enrollmentId]` | `/patient/insurance/payment/[enrollmentId]` | done | 1 | |
| `(app)/insurance/policy/[id]` | `/patient/insurance/policy/[id]` | done | 1 | |
| `(app)/insurance/ecard/[id]` | `/patient/insurance/ecard/[id]` | done | 1 | |
| `(app)/insurance/coverage-check` | `/patient/insurance/coverage-check` | done | 1 | |
| `(app)/insurance/claims/index` | `/patient/insurance/claims` | done | 1 | |
| `(app)/insurance/claims/new` | `/patient/insurance/claims/new` | done | 1 | |
| `(app)/insurance/claims/[id]` | `/patient/insurance/claims/[id]` | done | 1 | |
| `(app)/tenants/index` | `/patient/tenants` | done | 9 | |
| `(app)/tenants/[id]` | `/patient/tenants` | done | 9 | switcher, not a page per tenant |
| `(app)/family` | `/patient/family` | done | 0 | invites and lock in 8 |
| `(app)/caretakers` | `/patient/caretakers` | done | 0 | |
| `(app)/care-team` | `/patient/care-team` | done | 0 | add-member in 8 |
| `(app)/care-team-add` | `/patient/care-team/add` | done | 8 | |
| `(app)/marketplace` | `/patient/marketplace` | done | 8 | |
| `(app)/marketplace/[caretakerId]` | `/patient/marketplace/[caretakerId]` | done | 8 | |
| `(app)/marketplace-inquiries` | `/patient/marketplace/inquiries` | done | 8 | |
| `(app)/hospital/dashboard` | — | n-a-native | — | Mobile deep-links into web hospital portal |
| `(app)/hospital/doctors` | — | n-a-native | — | Mobile deep-links into web hospital portal |
| `(app)/hospital/patient-detail` | — | n-a-native | — | Mobile deep-links into web hospital portal |
| `(app)/hospital/patients` | — | n-a-native | — | Mobile deep-links into web hospital portal |
| `(app)/hospital/staff-invites` | — | n-a-native | — | Mobile deep-links into web hospital portal |
| `(app)/hospital/staff` | — | n-a-native | — | Mobile deep-links into web hospital portal |
| `(app)/hospital/walk-ins` | — | n-a-native | — | Mobile deep-links into web hospital portal |
| `(app)/hospital/ward-detail` | — | n-a-native | — | Mobile deep-links into web hospital portal |
| `(app)/hospital/wards` | — | n-a-native | — | Mobile deep-links into web hospital portal |
| `(app)/imaging/[studyUid]` | `/patient/imaging/[studyUid]` | done | 1 | |
| `(app)/imaging` | `/patient/imaging` | done | 1 | |
| `(auth)/login` | `/patient/login` | done | 0 | |
| `(auth)/register` | `/patient/register` | done | 5 | |
| `(auth)/forgot-password` | `/patient/forgot-password` | done | 5 | |
| `(auth)/verify-otp` | `/patient/verify-otp` | done | 5 | |
| `(auth)/mfa-setup` | `/patient/mfa/setup` | done | 5 | |
| `(auth)/mfa-challenge` | `/patient/mfa/challenge` | done | 5 | |
| `(auth)/request-demo` | `/request-demo` | n-a-native | — | Marketing-site surface, not patient-gated |
| push notifications | — | n-a-native | — | In-app feed plus SSE covers delivery on web |
