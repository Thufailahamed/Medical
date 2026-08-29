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
| `(app)/record-detail` | `/patient/records/[id]` | done | 0 | read-only; actions in 2 |
| `(app)/add-record` | `/patient/records/new` | planned | 2 | |
| `(app)/edit-record` | `/patient/records/[id]/edit` | planned | 2 | |
| `(app)/records/scan` | `/patient/records/scan` | planned | 6 | OCR via file upload |
| `(app)/records/trends` | `/patient/trends` | done | 0 | |
| `(app)/timeline` | `/patient/timeline` | planned | 9 | |
| `(app)/notes` | `/patient/notes` | done | 0 | |
| `(app)/allergies` | `/patient/allergies` | done | 0 | |
| `(app)/vitals` | `/patient/vitals` | done | 0 | |
| `(app)/vaccinations` | `/patient/vaccinations` | done | 0 | |
| `(app)/health-summary` | `/patient/health` | done | 0 | |
| `(app)/medicines` | `/patient/medications` | done | 0 | dose actions only; add/edit in 3 |
| `(app)/add-medicine` | `/patient/medications/new` | planned | 3 | |
| `(app)/edit-medicine` | `/patient/medications/[id]/edit` | planned | 3 | |
| `(app)/medicines-history` | `/patient/medications/history` | planned | 3 | |
| `(app)/refill` | `/patient/medications` | done | 0 | refill-due sheet on the medications page |
| `(app)/prescriptions` | `/patient/prescriptions` | planned | 3 | |
| `(app)/prescription-detail` | `/patient/prescriptions/[id]` | planned | 3 | |
| `(app)/verify/[id]` | `/portal/verify/[id]` | planned | 3 | exists on web outside /patient; consolidate |
| `(app)/appointments` | `/patient/appointments` | done | 0 | |
| `(app)/appointment-detail` | `/patient/appointments/[id]` | done | 0 | |
| `(app)/book-appointment` | `/patient/appointments/book` | planned | 4 | |
| `(app)/rate-visit/[appointmentId]` | `/patient/appointments/[id]/rate` | planned | 4 | |
| `(app)/doctor/[id]` | `/patient/doctors/[id]` | planned | 4 | |
| `(app)/teleconsult/[roomId]` | `/portal/teleconsult/[roomId]` | planned | 4 | exists at /portal; consolidate |
| `(app)/inbox` | `/patient/messages` | done | 0 | |
| `(app)/inbox/[id]` | `/patient/messages/[id]` | done | 0 | |
| `(app)/notifications` | `/patient/notifications` | done | 0 | |
| `(app)/notification-preferences` | `/patient/notifications/preferences` | planned | 8 | |
| `(app)/profile` | `/patient/profile` | done | 0 | read-only; editing in 5 |
| `(app)/edit-profile` | `/patient/profile/edit` | planned | 5 | |
| `(app)/appearance` | `/patient/settings/appearance` | planned | 5 | |
| `(app)/change-password` | `/patient/settings/password` | planned | 5 | |
| `(app)/support` | `/patient/support` | planned | 5 | |
| `(app)/email-import` | `/patient/settings/email-import` | planned | 5 | |
| `(app)/app-lock` | — | n-a-native | — | No browser SecureStore equivalent; session expiry covers it |
| `(app)/share` | `/patient/share` | done | 0 | |
| `(app)/export` | `/patient/export` | done | 0 | |
| `(app)/audit` | `/patient/audit` | done | 0 | |
| `(app)/activity` | `/patient/activity` | planned | 9 | |
| `(app)/emergency` | `/patient/emergency` | done | 0 | |
| `(app)/health-id` | `/patient/health-id` | done | 0 | |
| `(app)/ai/chat` | `/patient/ai/chat` | planned | 6 | |
| `(app)/ai/summary` | `/patient/ai` | done | 0 | |
| `(app)/ai/drug-check` | `/patient/ai` | done | 0 | |
| `(app)/ai/lab-explain` | `/patient/ai/lab-explain` | planned | 6 | |
| `(app)/ai/lab-trend` | `/patient/ai/lab-trend` | planned | 6 | |
| `(app)/ai/clinical-note` | `/patient/ai/clinical-note` | planned | 6 | |
| `(app)/ai/ocr` | `/patient/ai/ocr` | planned | 6 | file upload, not camera |
| `(app)/ai/vaccination-card` | `/patient/ai/vaccination-card` | planned | 6 | file upload, not camera |
| `(app)/test-catalog` | `/patient/diagnostic-tests` | done | 0 | |
| `(app)/test-detail/[slug]` | `/patient/diagnostic-tests/[slug]` | done | 0 | |
| `(app)/test-packages` | `/patient/diagnostic-tests/packages` | planned | 7 | |
| `(app)/test-package-detail/[slug]` | `/patient/diagnostic-tests/packages/[slug]` | planned | 7 | |
| `(app)/book-test` | `/patient/diagnostic-tests/[slug]` | done | 0 | booking form on the detail page |
| `(app)/test-bookings` | `/patient/diagnostic-tests/bookings` | planned | 7 | |
| `(app)/test-booking-detail/[id]` | `/patient/diagnostic-tests/bookings/[id]` | planned | 7 | |
| `(app)/test-result/[bookingId]` | `/patient/diagnostic-tests/bookings/[id]/result` | planned | 7 | |
| `(app)/rate-test/[bookingId]` | `/patient/diagnostic-tests/bookings/[id]/rate` | planned | 7 | |
| `(app)/insurance/index` | `/patient/insurance` | done | 1 | |
| `(app)/insurance/marketplace` | `/patient/insurance/marketplace` | planned | 1 | consolidate under /patient |
| `(app)/insurance/marketplace/[providerId]` | `/patient/insurance/marketplace/[providerId]` | planned | 1 | |
| `(app)/insurance/plans/[planId]` | `/patient/insurance/plans/[planId]` | planned | 1 | |
| `(app)/insurance/quote` | `/patient/insurance/quote` | planned | 1 | |
| `(app)/insurance/enroll/[planId]` | `/patient/insurance/enroll/[planId]` | planned | 1 | |
| `(app)/insurance/payment/[enrollmentId]` | `/patient/insurance/payment/[enrollmentId]` | planned | 1 | |
| `(app)/insurance/policy/[id]` | `/patient/insurance/policy/[id]` | planned | 1 | |
| `(app)/insurance/ecard/[id]` | `/patient/insurance/ecard/[id]` | planned | 1 | |
| `(app)/insurance/coverage-check` | `/patient/insurance/coverage-check` | planned | 1 | |
| `(app)/insurance/claims/index` | `/patient/insurance/claims` | planned | 1 | |
| `(app)/insurance/claims/new` | `/patient/insurance/claims/new` | planned | 1 | |
| `(app)/insurance/claims/[id]` | `/patient/insurance/claims/[id]` | planned | 1 | |
| `(app)/tenants/index` | `/patient/tenants` | planned | 9 | |
| `(app)/tenants/[id]` | `/patient/tenants` | planned | 9 | switcher, not a page per tenant |
| `(app)/family` | `/patient/family` | done | 0 | invites and lock in 8 |
| `(app)/caretakers` | `/patient/caretakers` | done | 0 | |
| `(app)/care-team` | `/patient/care-team` | done | 0 | add-member in 8 |
| `(app)/care-team-add` | `/patient/care-team/add` | planned | 8 | |
| `(app)/marketplace` | `/patient/marketplace` | planned | 8 | |
| `(app)/marketplace/[caretakerId]` | `/patient/marketplace/[caretakerId]` | planned | 8 | |
| `(app)/marketplace-inquiries` | `/patient/marketplace/inquiries` | planned | 8 | |
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
| `(auth)/register` | `/patient/register` | planned | 5 | |
| `(auth)/forgot-password` | `/patient/forgot-password` | planned | 5 | |
| `(auth)/verify-otp` | `/patient/verify-otp` | planned | 5 | |
| `(auth)/mfa-setup` | `/patient/mfa/setup` | planned | 5 | |
| `(auth)/mfa-challenge` | `/patient/mfa/challenge` | planned | 5 | |
| `(auth)/request-demo` | `/request-demo` | planned | 5 | marketing-site surface, not patient-gated |
| push notifications | — | n-a-native | — | In-app feed plus SSE covers delivery on web |
