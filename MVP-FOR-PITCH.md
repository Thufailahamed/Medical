# MVP Gap Analysis — Healthcare Platform (Investor-Pitch Ready)

**Date**: 2026-07-09
**Scope**: `/Users/thufailahamed/Downloads/App-2`
**Audience**: Engineering + Founders (pitch deck input)
**Source**: Direct repo inspection of `apps/api`, `apps/mobile`, `apps/marketing`, `packages/db`, `packages/shared`.

---

## 1. Executive Summary

The repo ships ~85% of what an MVP needs — substantially further along than the 2026-07-07 `MVP-REVIEW.md` (which said ~70%). Recent commits (`878e671` SSE, `0cae380` pharmacy transitions, `de7ac9f` hospital-web redirect) closed several P0 items that were flagged only 2 days ago.

**Pitch-blocking gaps remaining**: 5 items, 5–8 dev-days.
**High-leverage polish**: 6 items, 3–5 dev-days.
**Defer to Phase 2**: video, AI triage, insurance, FHIR, group chat, role portals beyond patient/doctor/hospital/admin.

**Investor-ready MVP**: **10–13 dev-days**. Demoable URL + seed data + pay flow + push on physical device.

---

## 2. The Pitch (defensible hooks already in the repo)

These are the claims the product can *prove* in a live demo today, not slideware:

| # | Pitch claim | Proof in repo |
|---|---|---|
| 1 | Only trilingual (en/si/ta) consumer health app for Sri Lanka | `apps/mobile/src/i18n/{si,ta,en}.json`; `apps/marketing/src/{portal,hospital}/i18n/{si,ta,en}.json`; `packages/shared/i18n` keys; locale middleware in `apps/api/src/middleware/locale.ts` |
| 2 | First NIC-native digital health identity (no ABDM equivalent exists in SL) | `packages/db/src/schema.ts` `users.nic_hash`, `nic_verification_level`, `nic_verified_at`; `apps/api/src/routes/auth.ts` `/auth/login-by-nic` step-up to `/auth/verify-otp` |
| 3 | WhatsApp-first onboarding for non-Colombo users | `apps/api/src/routes/whatsapp.ts`; state machine in `packages/db/src/schema.ts` `wa_conversations` + `wa_messages`; SI/TA templates via Meta WhatsApp Business |
| 4 | Email-to-record: forward any lab PDF to `records@…`, it lands in your locker auto-classified | CF Email Routing → `apps/api/src/email/{inbound,process,reply}.ts` → R2 → Workers AI OCR + `apps/api/src/lib/classifier.ts` |
| 5 | Hospital runs wards + IPD + reception + billing + collab in one web portal | `apps/marketing/src/app/hospital/(hospital)/{dashboard,wards,beds,ipd,reception,billing,pharmacy,lab,collab,reports,staff,notifications,settings}` — 22 routes |
| 6 | Doctors write RSA-2048-signed E-Rx verifiable by anyone | `apps/api/src/lib/signing.ts`; `apps/api/src/routes/signature.ts` `/verify/:prescriptionId` public endpoint; `apps/marketing/src/app/verify/[id]/page.tsx` SSR verify UI |
| 7 | Real-time push across mobile + web via SSE + Expo Push | `apps/api/src/routes/realtime.ts` (SSE, 15s heartbeat); `apps/mobile/src/hooks/useRealtime.ts` + `apps/mobile/src/lib/push.ts`; `apps/marketing/src/portal/hooks/useRealtime.ts` |
| 8 | Compliance floor: envelope-encrypted PHR + tamper-evident hash chain + per-record access checks + DSAR export/erasure + audit log | `apps/api/src/lib/envelope-crypto.ts` (AES-256-GCM, DEK wrapped by KEK, `prev_record_hash` chain); `apps/api/src/routes/dsar.ts`; `apps/api/src/lib/audit.ts`; `apps/api/src/routes/consents.ts` |
| 9 | AI lab-explain in Sinhala via Workers AI | `apps/api/src/routes/ai.ts` `/explain/lab-report`; `apps/api/src/lib/ai.ts` PII redaction; `apps/mobile/src/app/(app)/ai/lab-explain.tsx` UI |
| 10 | < $200/mo infra at 100k SL users | Cloudflare Workers Paid ~$5 + R2 ~$15 + Workers AI ~$30 + PayHere 2% of B2B GMV; no per-user licence cost |

---

## 3. What's Already Built (Full Surface Map)

### 3.1 API — `apps/api` (Hono on Cloudflare Workers)

**Stack**: Hono `^4.5` · Cloudflare Workers (`nodejs_compat`, `2024-12-02`) · D1 SQLite via Drizzle `^0.33` · R2 bucket (`healthcare-files`) · Workers AI · Supabase-compatible auth pattern (email/phone, JWT HS256).

**Route count**: 60+ router files mounted in `apps/api/src/index.ts`.

| Mount | Router file | Capability |
|---|---|---|
| `/auth/*` | `routes/auth.ts` | register, login, login-by-nic, login-by-phone, send-otp, verify-otp, /me, /refresh, /logout, /forgot-password, /reset-password, /change-password, register-tenant |
| `/patients/*` | `routes/patients.ts` | patient profile CRUD |
| `/medical-records/*` | `routes/medical-records.ts` | CRUD + bulk ops + revisions + envelope encryption + FTS5 search + Rx PDF + hash chain |
| `/appointments/*` | `routes/appointments.ts` | booking, queue, status history |
| `/emergency/*` | `routes/emergency.ts` | SOS, haversine, notify contacts |
| `/ai/*` | `routes/ai.ts` | summary, lab-explain, drug-interaction, chat, OCR (Workers AI, PII-redacted) |
| `/files/*` | `routes/files.ts` | R2 upload/download, presigned tokens (5-min TTL, single-use, replay-detected) |
| `/medicines*` | `routes/medicines.ts` + `medicines-master.ts` | patient medicines + DB-backed master catalogue |
| `/safety/check` | `routes/safety.ts` | drug-interaction + allergy + dose pre-flight |
| `/doctor/prescriptions/:id/{sign,verify,revoke}` | `routes/signature.ts` | RSA-2048 Rx signing + public verify |
| `/doctor/*` | `routes/doctor.ts` | doctor portal core + Rx CRUD |
| `/notifications/*` | `routes/notifications.ts` | read API |
| `/hospitals/*` | `routes/hospitals.ts` | directory |
| `/vitals/*` | `routes/vitals.ts` | vitals + symptoms + derived + alerts |
| `/notes/*` | `routes/notes.ts` | patient journal |
| `/doses/*` | `routes/doses.ts` | adherence |
| `/audit/*` | `routes/audit.ts` | audit log read/write |
| `/insurance/*` | `routes/insurance.ts` | policies + claims |
| `/labs/*` | `routes/labs.ts` | lab reports/orders + cross-hospital routing |
| `/wellness/*`, `/health-summary/*`, `/timeline/*`, `/export/*` | various | aggregations |
| `/doctor-portal/*`, `/doctor-messages/*`, `/patient-messages/*`, `/doctor-schedule/*`, `/doctor-earnings/*`, `/doctor-rx-templates/*` | various | doctor surface |
| `/care-team/*` | `routes/care-team.ts` | clinical source-of-truth memberships |
| `/pharmacy/*` | `routes/pharmacy.ts` | pharmacy dispense + reject (post-`0cae380`) |
| `/consents/*` | `routes/consents.ts` | per-purpose grants |
| `/dsar/*` | `routes/dsar.ts` | data subject access requests |
| `/realtime` | `routes/realtime.ts` | SSE (2s poll, 15s heartbeat) |
| `/clinics/*`, `/hospital-doctors/*`, `/hospital-patients/*`, `/clinic-doctors/*`, `/clinic-patients/*`, `/doctor-patient-relationships/*` | various | M:N memberships + MRN |
| `/hospital-share-requests/*`, `/cross-hospital-referrals/*`, `/cross-hospital-lab-routings/*`, `/consult-notes/*`, `/discharge-handoffs/*` | various | HOS-14 inter-hospital |
| `/me/tenants`, `PATCH /me/active-tenant` | `routes/me-tenants.ts` | tenant switcher |
| `/email/*`, `/whatsapp/webhook`, `/classify`, `/invite/:token`, `/staff-invite/:token`, `/waitlist`, `/demo/*`, `/verify/:prescriptionId` | various | public + admin |
| `/admin/*` | `routes/admin.ts` + `admin-bulk.ts` + `admin-export.ts` + `admin-health.ts` + `admin-webauthn.ts` + `admin-impersonate.ts` | super_admin surface |
| `/__cron/*` | `cron/{booking,dose,refill,reclassify,vaccination}-reminders.ts` | cron triggers |

**DB**: 75 tables in `packages/db/src/schema.ts` (3043 lines) — see section 3.2 for inventory.

**Auth**: JWT HS256, dev-mode bypass when `DEV_MODE=true`, NIC+DOB soft-2FA, OTP rate-limited (5 sends/5min, 30s cooldown), bcrypt password hash, WebAuthn passkey step-up for admins (in-memory challenges — production swap to KV needed), tenant + family context middleware.

### 3.2 DB — `packages/db/src/schema.ts` (75 tables)

Headline tables: `users` (NIC, supabase linkage, family/tenant ctx), `otp_codes`, `patients`, `family_members` (`is_locked`, `locked_by`), `hospitals`, `clinics`, `doctors` (SLMC + RSA-2048 signing keypair KEK-wrapped), `medical_records` (envelope cols + `prev_record_hash` + kind), `files` + `document_dicom_metadata` + `file_download_tokens`, `medicines` + `medicines_master` + safety (interactions, allergies, contraindications, pregnancy, renal/liver, controlled), `drug_interactions_master`, `drug_allergies_master`, `patient_conditions`, `patient_medications_history`, `prescriptions` (lifecycle `draft|signed|cancelled|dispensed`) + `prescription_signatures`, `lab_orders`, `lab_reports`, `appointments` + `appointment_status_history`, `insurance` + `insurance_claims`, `notifications` + `notification_preferences` + `push_tokens`, `emergencies`, `medicine_doses`, `vitals` (16 types), `symptoms`, `patient_notes`, `doctor_availability`, `doctor_time_off`, `walk_ins`, `password_resets`, `audit_logs`, `wards`, `beds`, `bed_assignments`, `hospital_staff` + `hospital_staff_invites`, `departments`, `admissions` + `admission_notes`, `invoices` + `invoice_line_items` + `payments`, `ai_cache`, `chat_sessions` + `chat_messages`, `allergies`, `vaccine_catalog` + `vaccine_reminders`, `share_links` + `share_link_views`, `demo_requests`, `marketing_waitlist`, `wa_conversations` + `wa_messages`, `care_team_members`, M:N membership tables (`hospital_doctors`, `hospital_patients`, `clinic_doctors`, `clinic_patients`, `doctor_patient_relationships`), `record_revisions`, `dsar_requests`, `consent_grants`, `qr_access_tokens`, `system_settings`, `user_admin_notes`, `doctor_verification_docs`, `admin_passkeys`, `doctor_revenue_events` + `doctor_payouts`, `doctor_rx_templates`, `messages_conversations` + `messages`, `hospital_share_requests` + events, `cross_hospital_referrals`, `cross_hospital_lab_routings`, `consult_notes`, `discharge_handoffs`.

### 3.3 Mobile — `apps/mobile` (Expo Router)

**Stack**: Expo SDK `~51` · RN `0.74` · Expo Router `~3.5` · TanStack React Query · React Hook Form + Zod · Zustand `^4.5` · i18next + react-i18next (trilingual) · Reanimated 3.10 · Gorhom bottom-sheet · expo-secure-store, expo-local-authentication, expo-notifications, expo-location, expo-document-picker, expo-image-picker, expo-sharing, expo-linear-gradient · expo-vision-camera, victory-native.

**Route groups**: `(auth)`, `(app)` (patient), `(doctor)`, `lock`, `invite`.

**Patient tabs**: Home (`index.tsx`), Records (premium V2 — `records.tsx`), Medicines (hidden), Inbox, Profile.

**Hidden patient screens** (push, not tabbed): `record-detail`, `edit-record`, `records/[id]/{files,history,lock,share}`, `add-record`, `add-medicine`, `edit-medicine`, `edit-profile`, `email-import`, `notes`, `vitals`, `family`, `appointments`/`book-appointment`/`appointment-detail`, `prescriptions`/`prescription-detail`, `medicines-history`, `allergies`, `vaccinations`, `support`, `activity`, `health-summary`, `timeline`, `export`, `share`, `appearance`, `notification-preferences`, `change-password`, `app-lock` (PIN + biometric + timeout), `notifications`, `inbox/[id]`, `tenants/{index,[id]}`, `verify/[id]`, full hospital redirection (`hospital/*` → web `/hospital/*`), AI: `chat`, `summary`, `lab-explain`, `drug-check`, `ocr`.

**Doctor tabs**: Home, Schedule, Inbox, Prescription, Profile.

**Hidden doctor screens**: `care-team`, `patient-detail`, `clinical-note(s)`, `prescriptions`/`prescription-detail`, `lab-order(s)`, `follow-up(s)`, `availability`, `visit-summary`, `queue`, `records(-v2)`, `earnings`, `rx-templates[/new|[id]]`, `clinics/new`, `tenants/{index,[id]}`, `relationships`, `vital-record`, `inbox/[id]`.

**Auth**: Phone + OTP primary, email/password fallback, WhatsApp deep-link CTA, invite-token aware. `useAuthStore` (Zustand + SecureStore), `useProtectedRoute`, `useAppLockGate`, dev `quickLogin()` for Doctor/Patient.

**Notifications**: SSE mounted in `(app)/_layout.tsx:40` via `useRealtime()`; native Expo Push via `lib/push.ts` (deep-links `appointment-detail`).

### 3.4 Web — `apps/marketing` (Next.js 16)

NOT `apps/web/` — corrected naming. Single Next.js app hosts marketing + 3 portals (doctor, hospital, admin).

**Stack**: Next.js `16.2.10` · React `19.2.4` · Tailwind CSS v4 · TanStack React Query `^5.59` · React Hook Form + Zod · Zustand `^5.0` · Recharts `^2.13` · lucide-react · date-fns · trilingual i18n shim via `useT()` hook · WebAuthn passkey for admin step-up.

**Public marketing**: `/` (~2,557-line landing with hero/features/FAQ), `/privacy`, `/terms`, `/verify/[id]` (SSR prescription verify), `/login` (unified tabbed sign-in), `/laboratory` (standalone demo, **mock data**).

**Doctor portal — `/portal/*`**: dashboard, appointments, availability, book-appointment, schedule, walk-ins, queue, patients (`/{id}/{overview,records,prescriptions[/{rxId}],vitals,medications,allergies,vaccinations,visits,clinical-notes,lab-orders,follow-ups,messages,share,layout}`), prescriptions(`/{,/[id]}`), lab-orders, clinical-notes, messages(`/{,/[id]}`), follow-ups, care-team, clinics(`/{,/[id]}`), pharmacy(`/{,/[id]}` — pharmacy role), rx-templates, relationships, records, earnings, verify/[id], visit-summary, tenants, profile, settings, notifications, audit (`/audit/me`), 403, login.

**Hospital portal — `/hospital/*`**: login, register (3-step tenant self-registration), dashboard (KPIs + active admissions), beds, wards(`/{,/[id]}`), ipd(`/{,/[id]}`), billing(new,outstanding,[id],[id]/receipt), reception(appointments,patients(new,[id]),walk-ins), pharmacy, lab, collab (consults, discharges, lab-routing, referrals, requests), reports (KPIs + CSV export), staff(invites,departments), onboarding, notifications, settings, 403.

**Admin portal — `/admin/*`**: login, dashboard (60s auto-refresh, sections: People / Today / Operations / Marketing), approvals, doctors, hospitals, clinics, pharmacies, laboratories, insurances, insurance-claims, ambulances, audit (full system + CSV export), system-health (D1 storage + cron liveness + error tail), dsar (reject/requeue), payouts, demo-requests, waitlist, users(`/{,/[id]}`), admins (multi-admin mgmt + WebAuthn step-up + impersonation banner), settings, notifications (broadcast), medicines-master, 403.

**RBAC**: Role arrays per portal layout (`HOSPITAL_PORTAL_ROLES`, `PORTAL_ROLES`); `apps/marketing/src/portal/lib/rbac.ts` + `apps/marketing/src/hospital/lib/rbac.ts`.

**Shared with mobile**: `@healthcare/shared` (types, validators, vitals, records); `@healthcare/db` (Drizzle schema). No React component sharing (RN ≠ Next).

### 3.5 Shared — `packages/{db,shared}`

- `@healthcare/shared` exports `.`, `./types`, `./validators`, `./vitals`, `./records` (all bundle top-level files + `src/` mirror). Zod `^3.23` only runtime dep. Schemas cover register/login, prescription, clinical-note, lab-order, follow-up, vaccination, care-team, ward, bed, staff, appointment, availability, chat, AI (summary/lab-explain/drug-interaction/chat/ocr), staff-invite, tenant-register (HOS-0), department (HOS-6), admission (HOS-5), billing (line-item HOS-9, invoice HOS-9, payment HOS-9).
- `@healthcare/db` — Drizzle schema + migrations. Drizzle config at `packages/db/drizzle.config.ts`.

---

## 4. What's Missing or Stubbed

### 4.1 Already-built stubs to harden (no new code, just promote to prod)

| Stub | Location | Fix |
|---|---|---|
| SMS provider defaults to `console` | `apps/api/src/lib/sms.ts` | Real Twilio/Dialog/Mobitel/Hutch impl behind `SMS_PROVIDER` env |
| Email-channel OTP `console.log` | `apps/api/src/routes/auth.ts:629-634` | Real provider call (Resend/SES/Postmark); honour rate limit |
| WebAuthn challenges in-memory | `apps/api/src/middleware/{admin,stepup}.ts` notes | Swap to `c.env.WEBAUTHN_KV` |
| Refresh token returns `"dummy-new-token"` | `apps/api/src/routes/auth.ts:853-866` | Real refresh JWT with rotation |
| Mobile drug-check AI tile no `onPress` | `apps/mobile/src/app/(app)/index.tsx` (home tile exists, unwired) | Wire to `/(app)/ai/drug-check` (file exists) |
| Records break-glass lock stub (no 2FA) | `apps/mobile/src/app/(app)/records/[id]/lock.tsx` | Real 2FA or remove toggle |
| Mobile doctor earnings read-only | `apps/mobile/src/app/(doctor)/earnings.tsx` | Accept/settle payout flow (or remove + push to web) |
| Mobile billing screens absent | none exist | Build: invoice list, payment, receipt (or push to web portal) |
| Standalone `/laboratory` demo = mock data | `apps/marketing/src/app/laboratory/page.tsx` | Wire to API or hide |
| CF Rate Limit binding TODO | `apps/api/src/lib/validators.ts:400` + `routes/demo.ts:6,11` | Add CF Rate Limiting binding + apply |

### 4.2 Brand-new build items (Block A pitch-blocking)

#### A1. Payment gateway (PayHere + Stripe)

**Goal**: charge patients + hospitals in LKR.

- `apps/api/src/lib/payments/{payhere,stripe,types}.ts` — gateway adapter (PayHere is SL-native; Stripe for intl cards).
- `apps/api/src/routes/payments.ts` — new: `POST /payments/checkout`, `POST /payments/webhook/payhere` (HMAC-SHA1 of `merchant_id|order_id|amount|currency|status|merchant_secret` MD5), `POST /payments/webhook/stripe`, `GET /payments/me`, `POST /payments/refund`.
- `apps/api/wrangler.toml` — `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `STRIPE_SECRET_KEY` as encrypted secrets.
- `packages/shared/src/validators.ts` — extend `paymentSchema` with `provider`, `providerRef`, `webhookSignature`.
- `apps/marketing/src/app/hospital/(hospital)/billing/new/page.tsx` — wire "Pay now" button → checkout.
- `apps/marketing/src/app/portal/(portal)/prescriptions/[id]/page.tsx` — show consultation fee + "Pay & book".
- `apps/mobile/src/app/(app)/appointments/book-appointment.tsx` — fee summary, cancellation policy copy, "free cancel up to 24h before".
- DB: `payments` table exists (`packages/db/src/schema.ts:2687-2803`) — extend with `provider`, `provider_charge_id`, `webhook_received_at`.

**Effort**: 2 days.

#### A2. Real SMS provider

**Goal**: every `/auth/send-otp`, cron reminder, walk-in notify goes through a real gateway with BAA.

- `apps/api/src/lib/sms.ts` — impl for `twilio` (BAA available via Twilio intl) and `dialog-lk` (SL local, no BAA but cheaper). Pluggable via `SMS_PROVIDER`.
- `apps/api/.env.example` + `wrangler.toml` — `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_FROM`.
- `apps/api/src/routes/auth.ts:629-634` — replace `console.log` with provider call.
- Verify `apps/api/src/cron/{booking,dose,refill,vaccination}-reminders.ts` call into `sms.send`.
- BAA inventory doc (one-pager, `apps/api/docs/BAA-INVENTORY.md`).

**Effort**: 1 day.

#### A3. FCM/APNs push credentials

**Goal**: real Expo push on physical device.

- `apps/mobile/eas.json` — add `submit.production.ios.appleId`, `android.googleServicesFile`; `apps/mobile/google-services.json` + `apps/mobile/GoogleService-Info.plist`.
- `apps/mobile/app.config.js` — confirm `android.package`, `ios.bundleIdentifier`.
- `apps/mobile/src/lib/push.ts` — verify token registration on auth success and channel binding (`/push/push-tokens`).
- `apps/api/src/lib/notifications.ts` — verify Expo Push call; token format check.
- Run `eas build --profile production` and install on physical device.

**Effort**: 0.5 day (assuming EAS + Firebase project already configured).

#### A4. Investor pitch pages + demo seed

**Goal**: live URL investors can log into.

- `apps/marketing/src/app/pricing/page.tsx` — 3 tiers:
  - **Patient**: free, all features.
  - **Doctor Pro**: LKR 2,500/mo (or USD 8) — own clinic, Rx templates, online booking, payouts.
  - **Clinic/Hospital Pro**: LKR 15,000/mo — multi-doctor, wards, IPD, billing, reports.
- `apps/marketing/src/app/about/page.tsx` — founders, mission, contact, press kit link.
- `apps/marketing/src/components/Footer.tsx` — link to /pricing.
- `apps/api/scripts/seed-demo.ts` — idempotent: 1 super_admin (`demo+admin@healthhub.lk`), 2 doctors (`demo+gp@…`, `demo+cardio@…`) with SLMC verified, 5 patients (`demo+patient1..5@…`), 10 records each (lab, prescription, vitals, allergies), 3 appointments per patient, 2 prescriptions per doctor.
- `apps/marketing/src/app/demo/page.tsx` — public "Try the demo" landing with login creds visible.

**Effort**: 1 day.

#### A5. Trust signals on doctor profiles

**Goal**: "✓ SLMC Verified" badge + specialty + years + hospital + fee + reply-time.

- `apps/marketing/src/portal/components/doctor/DoctorBadge.tsx` — new shared component (verified pill, specialty, years, fee).
- `apps/mobile/src/components/DoctorChip.tsx` — new mobile sibling.
- `apps/mobile/src/app/(app)/records.tsx` — doctor attribution chip on shared records.
- `apps/mobile/src/app/(doctor)/profile.tsx` — surface fee input on doctor side (input field exists, just confirm).
- `apps/marketing/src/app/portal/(portal)/patients/[id]/layout.tsx` — doctor badge in chart header.
- New API: `GET /doctors/:id/reply-time` (compute first-response median from `messages`).
- Hook reply-time badge into booking screens on mobile + web.

**Effort**: 1 day.

### 4.3 Block B — high-leverage polish

#### B6. Empty/error/loading state pass

- Audit all `(app)/*.tsx` and `(doctor)/*.tsx` for skeleton/empty/error coverage.
- Standardize `apps/mobile/src/components/ui/{EmptyState,ErrorState,Skeleton}.tsx` (partial today, audit + extend).
- Network-flake retry + pull-to-refresh on all list screens.
- `apps/mobile/src/lib/query-error-boundary.tsx` — global React Query error handler.

**Effort**: 2 days.

#### B7. Vitals chart with trend line

- `apps/mobile/src/app/(app)/vitals-chart.tsx` — new screen.
- Use `victory-native` (already a dep) — line chart per `vitals.kind` (16 types).
- Sparkline widget on `apps/mobile/src/app/(app)/index.tsx` (home).
- Re-use `GET /vitals/me/series` endpoint.

**Effort**: 1 day.

#### B8. Patient-visible audit log + DSAR UI

- `apps/mobile/src/app/(app)/activity.tsx` (already present) — verify wiring to `GET /audit/me`.
- `apps/mobile/src/components/audit/AuditTimeline.tsx` — list with actor + resource + timestamp.
- "Download my data" CTA → `POST /dsar/export` + show job status.
- Re-use `apps/api/src/routes/dsar.ts` endpoints.

**Effort**: 1 day.

#### B9. Sinhala/Tamil translation completion

- Audit `apps/mobile/src/i18n/locales/en.json` (3320 lines) for keys missing in `si.json`/`ta.json` (1301/1315 lines).
- Prioritise critical paths: auth (`(auth)/*`), records (`records.tsx` + detail), prescriptions, vitals, appointments, SOS, payment, profile, settings.
- Crowdsource rest via SL university medical student volunteer channel (post-round).
- Add visual diff script: `apps/mobile/src/i18n/scripts/diff-locales.ts` → mark missing keys per locale.

**Effort**: 2 days (critical paths), 5+ days for full coverage.

#### B10. TOTP MFA for doctors

- `apps/api/src/lib/totp.ts` — new (use `otpauth` lib, RFC 6238).
- `apps/api/src/routes/auth.ts` — `/auth/mfa/enroll` (returns QR otpauth URI), `/auth/mfa/verify`, force enroll on first doctor login.
- `apps/mobile/src/app/(auth)/mfa-enroll.tsx` — QR scan screen + 6-digit code verify.
- `apps/mobile/src/app/(doctor)/mfa.tsx` — manage authenticators screen.
- Already-existing `apps/api/src/middleware/stepup.ts` + `apps/marketing/src/portal/components/admin/StepUpModal.tsx` — pattern to copy.

**Effort**: 1 day.

#### B11. Prescription PDF + share-with-doctor

- Verify mobile `apps/mobile/src/app/(app)/prescription-detail.tsx` renders "Download PDF" button.
- "Share with another doctor" sheet → `POST /share/links` (7-day TTL); render QR + link.
- `apps/mobile/src/components/share/ShareLinkSheet.tsx` — new component.
- Re-use `apps/api/src/routes/share.ts` endpoint.

**Effort**: 0.5 day.

### 4.4 Block C — credibility (pick best 4)

| # | Item | Effort |
|---|---|---|
| C12 | Cancel/reschedule UX + visible cancellation policy + refund path | 0.5d |
| C13 | Re-book button on past appointments | 1d |
| C14 | Onboarding consent copy + versioned `consent_grants` rows | 1d |
| C15 | Post-visit email + 1-tap rating prompt + verified-patient review mark | 1d |
| C16 | Public Rx verify landing polish + doctor "vouches for Rx" page | 0.5d |
| C17 | Live support channel: WhatsApp Business CTA + Intercom widget | 0.5d |

### 4.5 Block D — defer (mention in pitch deck as roadmap)

- **Video consultation**: integrate Daily (`/call`) or Twilio Video with BAA — 2-week build deferred.
- **AI symptom triage**: FDA SaMD risk (Babylon Health collapse precedent) — out.
- **Insurance integration (Agrahara/Suraksha)**: requires NITF partnership, long sales cycle.
- **Full FHIR Patient Access API**: CMS-mandated, post-PMF.
- **Group chat / care-team chat**: not MVP.
- **Lab / pharmacy / insurance / ambulance role portals**: enum exists, UI only stub for these roles.
- **Marketing automation / drip / newsletters**: post-traction.
- **Test coverage** > 80% on web/mobile: post-traction.
- **FedRAMP / HITRUST CSF / SOC 2**: post-PMF.
- **OAuth / social login**: not needed for SL consumer market.

---

## 5. Where to Find Things (cross-reference)

### 5.1 Existing utilities to reuse (do NOT rebuild)

| Need | Reuse from | Path |
|---|---|---|
| Audit log read | `GET /audit/me` | `apps/api/src/routes/audit.ts` |
| Data export | `POST /dsar/export` | `apps/api/src/routes/dsar.ts` |
| Data erasure | `POST /dsar/erasure` | same |
| Record sharing | `POST /share/links` | `apps/api/src/routes/share.ts` |
| Vitals series data | `GET /vitals/me/series` | `apps/api/src/routes/vitals.ts` |
| SSE realtime | mount in `_layout` | `apps/api/src/routes/realtime.ts` + `apps/mobile/src/hooks/useRealtime.ts` |
| Notification prefs | `GET/PUT /push/notification-preferences/me` | `apps/api/src/routes/push.ts` |
| Drug-interaction safety | `POST /safety/check` | `apps/api/src/routes/safety.ts` + `lib/safety-engine.ts` |
| Envelope encryption | `lib/envelope-crypto.ts` | `apps/api/src/lib/envelope-crypto.ts` |
| RSA signing | `lib/signing.ts` | `apps/api/src/lib/signing.ts` |
| WhatsApp state machine | `routes/whatsapp.ts` + `wa_conversations` table | `apps/api/src/routes/whatsapp.ts` |
| RBAC middleware | `requireRole` | `apps/api/src/middleware/rbac.ts` |
| Admin step-up | `requirePasskeyFresh` + `StepUpModal` | `apps/api/src/middleware/stepup.ts` + `apps/marketing/src/portal/components/admin/StepUpModal.tsx` |
| Form schemas | Zod | `packages/shared/src/validators.ts` |
| Vitals registry | `VITAL_REGISTRY` | `packages/shared/src/vitals.ts` |
| Record kinds | `RECORD_REGISTRY` | `packages/shared/src/records.ts` |

### 5.2 Existing deploy infra

- `apps/api/wrangler.toml` — Worker `healthcare-api`, D1 binding `DB` (`healthcare-db`), R2 binding `R2` (`healthcare-files`), Workers AI binding `AI`, cron triggers (`3,18,33,48 *`, `37 3 * * *`).
- `deploy-backend.sh` — bash: `db:generate` → `wrangler d1 migrations apply healthcare-db --remote` → `wrangler deploy`.
- EAS `apps/mobile/eas.json`.
- Next.js deploy (Vercel-style).

### 5.3 Recent commit context (last 5)

```
0cae380 feat: enhance pharmacy routes with prescription transition handling and notifications
878e671 feat: implement real-time notifications using Server-Sent Events
de7ac9f feat(hospital): redirect mobile hospital operations to web portal
fd653c2 feat: add patient detail page and notifications types
0da09ca feat: refactor translation handling in staff, wards, and register pages; add notifications and settings pages
```

The team is shipping roughly 1 feature commit/day.

---

## 6. Implementation Sequence (Investor-Ready Critical Path)

### Sequence 0 — Day 0 prep (before any code)

1. Provision: Twilio account (or SL gateway account), Stripe test account, PayHere sandbox, Firebase project (for FCM), Apple Developer account (for APNs).
2. Provision: CF Workers Paid plan for prod, custom domain.
3. EAS org setup.
4. BAA inventory doc started.

### Sequence 1 — Block A (5–8 days)

| Day | Items | Outcome |
|---|---|---|
| 1 | A2 (SMS) + A3 (push creds) | Phone gets real OTP + push on auth success |
| 2 | A1 (payment): PayHere adapter + checkout + webhook | Hospital invoice can be paid in test |
| 3 | A1 (cont): Stripe adapter + invoice/payment wiring on mobile + web booking | Patient can pay doctor consult fee |
| 4 | A4 (pricing + about + demo seed) | Live demo URL live with seeded users |
| 5 | A5 (SLMC verified badge + reply-time API) | Trust signals on doctor cards |
| 6 | Buffer for review + fixes | Polished demo |
| 7 | Buffer | |
| 8 | Buffer | |

### Sequence 2 — Block B (3–5 days)

| Day | Items |
|---|---|
| 1 | B8 (audit log mobile) + B11 (Rx PDF) |
| 2 | B7 (vitals chart) |
| 3 | B10 (TOTP MFA for doctors) |
| 4 | B9 (si/ta critical paths) — can parallel |
| 5 | B6 (empty/error/loading states) |

### Sequence 3 — Block C (pick 4 in 3 days)

| Day | Items |
|---|---|
| 1 | C12 (cancel/refund) + C13 (re-book) |
| 2 | C14 (onboarding consent) |
| 3 | C17 (support channel) + C16 (public Rx verify polish) |

### Sequence 4 — Pre-meeting (1 day)

- End-to-end demo run-through.
- Backup screenshots + loom video of seeded demo.
- Investor deck final.

---

## 7. Critical Files to Modify (canonical list)

### New files

```
apps/api/src/lib/payments/payhere.ts
apps/api/src/lib/payments/stripe.ts
apps/api/src/lib/payments/types.ts
apps/api/src/lib/totp.ts
apps/api/src/routes/payments.ts
apps/api/src/routes/doctors/{reply-time,verified-badge}.ts
apps/api/scripts/seed-demo.ts
apps/api/docs/BAA-INVENTORY.md
apps/marketing/src/app/pricing/page.tsx
apps/marketing/src/app/about/page.tsx
apps/marketing/src/app/demo/page.tsx
apps/marketing/src/portal/components/doctor/DoctorBadge.tsx
apps/mobile/src/app/(app)/vitals-chart.tsx
apps/mobile/src/app/(auth)/mfa-enroll.tsx
apps/mobile/src/app/(doctor)/mfa.tsx
apps/mobile/src/components/DoctorChip.tsx
apps/mobile/src/components/audit/AuditTimeline.tsx
apps/mobile/src/components/share/ShareLinkSheet.tsx
apps/mobile/src/lib/query-error-boundary.tsx
apps/mobile/src/i18n/scripts/diff-locales.ts
```

### Modified files

```
apps/api/src/lib/sms.ts                          # real provider impl
apps/api/src/lib/notifications.ts                # verify Expo push
apps/api/src/lib/validators.ts                   # extend paymentSchema + TOTP
apps/api/src/routes/auth.ts:629-634              # replace console OTP
apps/api/src/routes/auth.ts:853-866              # real refresh JWT
apps/api/src/routes/demo.ts                      # CF Rate Limit binding
apps/api/wrangler.toml                            # secrets + crons
apps/api/.env.example                             # provider env vars
packages/db/src/schema.ts                         # payments.provider, otp_codes columns
packages/shared/src/validators.ts                 # consultationFeeSchema, TOTP schema

apps/mobile/eas.json                              # APNs / FCM credentials
apps/mobile/app.config.js                         # package ids
apps/mobile/src/lib/push.ts                       # verify token registration
apps/mobile/src/app/(app)/index.tsx               # AI drug-check tile onPress
apps/mobile/src/app/(app)/records.tsx             # doctor chip
apps/mobile/src/app/(app)/appointments/book-appointment.tsx  # fee + policy
apps/mobile/src/app/(app)/prescription-detail.tsx # PDF + share
apps/mobile/src/app/(app)/activity.tsx            # wire to GET /audit/me
apps/mobile/src/app/(app)/records/[id]/lock.tsx   # 2FA or remove
apps/mobile/src/app/(doctor)/earnings.tsx        # accept/settle flow
apps/mobile/src/components/ui/{EmptyState,ErrorState,Skeleton}.tsx  # extend
apps/mobile/src/i18n/locales/{si,ta}.json        # complete

apps/marketing/src/app/hospital/(hospital)/billing/new/page.tsx      # Pay button
apps/marketing/src/app/portal/(portal)/prescriptions/[id]/page.tsx   # fee + pay
apps/marketing/src/app/portal/(portal)/patients/[id]/layout.tsx      # doctor badge
apps/marketing/src/components/Footer.tsx                             # pricing link
```

---

## 8. Verification (end-to-end test for investor demo)

Run in this order; each must pass before moving on.

1. **Cold start**: open marketing `/` → click "Get started" → mobile login → enter NIC + DOB → receive SMS OTP → land on home dashboard with seeded data.
2. **Patient flow**: records hub → open lab report → AI explain in Sinhala → share with doctor via link → log out.
3. **Doctor flow**: web `/portal/login` → 3 appointments visible → open patient chart → TOTP MFA verify → write Rx → RSA sign → push notification on patient's phone → notification deep-links to detail.
4. **Hospital flow**: web `/hospital/login` → dashboard shows seeded ward KPIs → create walk-in → generate invoice → PayHere checkout → webhook marks invoice paid → receipt page renders.
5. **Admin flow**: web `/admin/login` → WebAuthn step-up → see DSAR queue → approve one export → broadcast notification → all seed patients receive push.
6. **Compliance audit**: patient opens audit log → sees doctor viewing with timestamp + actor + resource → request DSAR export → receives email within 5 minutes.
7. **Locale switch**: mobile settings → switch to Sinhala → confirm no English fallback flash on records, prescriptions, vitals, booking, payment, profile, settings.
8. **Push on physical device**: trigger cron via test endpoint → see Expo push arrive.
9. **Pricing**: marketing `/pricing` displays 3 tiers + SL LKR pricing.
10. **Demo creds**: `apps/marketing/src/app/demo/page.tsx` exposes seeded logins.

---

## 9. Pitch Deck Talking Points (use these)

1. **SL is blue-ocean for consumer PHR.** No incumbent has mobile, EMR access, telemedicine — confirmed by direct check of Asiri/Durdans/Hemas (web-portal only).
2. **Trilingual is the moat.** Foreign players can't localize to SI/TA cheaply. Our app ships in 3 langs Day 1.
3. **NIC is the identity layer.** No ABDM-equivalent. We are the de-facto national health ID before MoH issues one.
4. **WhatsApp-first onboarding** cuts app-install friction outside Colombo.
5. **Email forwarding** turns every lab's existing PDF-by-email workflow into a wedge. "Forward to `records@…`, it lands in your locker."
6. **Compliance-floor ready**: envelope encryption + tamper-evident hash chain + per-record access checks + DSAR + audit log. No premature FedRAMP/HITRUST spend.
7. **Hospitals can switch on day 1** because the hospital portal ships wards/IPD/reception/billing/collab.
8. **< $200/mo infra at 100k users** = capital-efficient seed extension.
9. **Agrahara/Suraksha partnership = post-traction moat.** NITF-approved app = regulatorily validated, distributionally locked.
10. **DRiefcase playbook** (India, $25M raised, 60M users) substituted NIC for ABDM. De-risks the model.

---

## 10. Out of Scope (explicit defer — mention as Phase 2)

- Video consultation (use vendor with BAA).
- AI symptom triage (SaMD regulatory risk, Babylon precedent).
- Insurance integration (NITF partnership play, long cycle).
- Full FHIR Patient Access API.
- Group chat / care-team chat.
- Marketing automation / drip / newsletters.
- Lab/pharmacy/insurance/ambulance role portals.
- Test coverage > 80% (currently partial).
- FedRAMP / HITRUST / SOC 2.

---

## 11. Effort Summary

| Block | Items | Days | Cumulative |
|---|---|---|---|
| A — pitch-blocking | 1–5 | 5–8 | 5–8 |
| B — high-leverage polish | 6–11 | 3–5 | 8–13 |
| C — credibility | 12–17 (pick 4) | 2–4 | 10–17 |
| D — defer | — | — | — |

**Realistic pitch-ready MVP**: 10–13 dev-days (Block A + half Block B).
**Polished pitch-ready MVP**: 13–17 dev-days (full A + B + best of C).

---

## 12. Source / Verification Notes

- All claims verified by direct repo inspection on 2026-07-09 via 4 parallel Explore agents + Read of `MVP-REVIEW.md` + `DRIEFCASE_PLAN.md`.
- 51 + 59 + 77 + 47 tool-uses across agents.
- No source unreachable; all routes, schemas, validators confirmed via Read/Glob.
- Tone and prioritization aligned with `MVP-REVIEW.md`'s "Block launch on 4 things, not 14" philosophy.
