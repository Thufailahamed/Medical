# MVP Review — Healthcare Monorepo

Date: 2026-07-07
Scope: `/Users/thufailahamed/Downloads/App-2`

---

## TL;DR Verdict

**~70% MVP.** Core patient + doctor flows ship-ready. Missing: real notifications (SMS/push wired to provider), payment capture, video/telehealth, hardened compliance floor, polished empty/error states, trust signals (ratings, verified badges), reminder cron activated.

Patient/doctor loop works end-to-end. **Block launch on 4 things**, not 14.

---

## What Built (compact)

| Layer | Status |
|---|---|
| Identity | JWT + email/phone/NIC+OTP login, password reset, MFA-style OTP for NIC. Multi-role: patient, doctor, hospital_admin, hospital_staff, laboratory, pharmacy, insurance, ambulance, super_admin |
| Patient mobile | Book/view/reschedule/cancel appointments, medical records (encrypted envelope + revisions), prescriptions + signature verify, vitals + symptoms + alerts, medicines + reminders, allergies, vaccinations, AI chat/OCR/drug-check/lab-explain, family + care team, share + QR + emergency, consents, DSAR export/erasure |
| Doctor mobile + web portal | Dashboard, queue, schedule, availability, time-off, patient search, clinical notes, vitals, visit summary, lab orders, prescriptions (RSA-signed), templates, follow-ups, messages, earnings |
| Hospital portal | Wards, beds, staff, staff invites, walk-ins, patient list |
| Data model | 86 tables (Drizzle/D1). FHIR-leaning envelopes, audit log, consents, share links, DSAR, signatures, files |
| i18n | en/si/ta across API + mobile |
| Marketing site | Next.js 16, landing + hospital + lab verticals, waitlist, demo, privacy/terms |

Patient + doctor sides both functional. Hospital/lab/pharmacy/insurance/ambulance roles exist in enum but mostly stub.

---

## Missing for MVP (ranked by impact)

### P0 — block launch

1. **Real SMS + push provider wired.** `lib/sms.ts` + `lib/push.ts` stubs only. Auth `console.log`s OTP for email channel. Without working reminders, no-show rates hit 25–40%. Single biggest revenue lever.
2. **HIPAA/GDPR floor hardened.** Audit log written, but no UI. RBAC OK. Need: BAA inventory (Cloudflare, Twilio, Sentry, email, push), breach runbook (60d US / 72h EU), MFA mandatory for doctors, log-scrubbing for PHI in observability.
3. **Payment + transparent fee flow.** No Stripe/payment endpoint. Patients see no price until booking. Trust killer.
4. **Empty/error/loading states + cancel/reschedule polish.** Network flake on mobile = reputation hit. Cancellation policy visible before booking.

### P1 — ship within 2 weeks of launch

5. **Doctor verification badge** (SLMC flag exists, no UI). Specialty + years + hospital affiliation on profile.
6. **Post-visit rating prompt + email summary.** Compounds reviews.
7. **Prescription PDF export + share-with-doctor link.** Viral growth lever + interop credibility.
8. **Vitals chart with trend line.** Records exist, no chart. 1-day effort, huge "real medical app" signal.
9. **Patient-visible audit log** ("who viewed my record"). GDPR right-to-access + strong trust signal.
10. **Doctor response-time badge** ("usually replies in 2h"). Computable from existing data.

### P2 — credibility multipliers (1–2 days each)

- Re-book button on past appointments
- Family profile switching UX polish
- Onboarding that explains *why* data consent needed
- Cancel/refund path visible in app
- "Verified patient" mark on reviews
- Public total consultations ("12,000+ patients seen")

### Defer (phase 2, not MVP)

- AI symptom triage (high cost, low accuracy, FDA SaMD risk — Babylon-style collapse)
- Video consultation from scratch (use Daily/Twilio with BAA)
- Insurance integration
- Full FHIR Patient Access API for CMS compliance
- Group chat / care-team chat
- Marketing automation / newsletters
- Lab portal full UI (lab/pharmacy/insurance/ambulance roles remain stub)
- Admin dashboard
- Web/mobile test coverage

---

## Compliance Floor (MVP minimum, not full cert)

| Item | Now | Need |
|---|---|---|
| Encryption at rest + TLS 1.2+ | Yes (envelope) | Confirm TLS config |
| Audit log of PHI access | Yes (table + endpoint) | Surface in UI |
| Patient export + deletion | Yes (DSAR endpoints) | Add UI; rehearse erasure |
| Consent log with version + timestamp | Yes | Make auditable |
| MFA for doctors | Partial (OTP only) | Add TOTP mandatory for doctor role |
| RBAC | Yes | Stress test |
| Privacy Policy + Terms linked signup | Yes (marketing pages) | Mobile onboarding too |
| BAA inventory | Unknown | Document every PHI-touching vendor |
| Risk Assessment + Privacy/Security Officer named | Unknown | Write doc, name officer |
| Breach runbook | No | Write + rehearse (60d US / 72h EU) |

Don't chase: FedRAMP, HITRUST CSF, SOC 2 Type II — post-PMF.

---

## Quick Wins (ranked by ROI)

| # | Win | Effort | Why |
|---|---|---|---|
| 1 | Wire SMS/push provider (Twilio + FCM/APNs) | 1–2d | Drops no-shows 25–40% |
| 2 | Prescription PDF export | 1d | Share-with-other-doctor viral lever |
| 3 | Vitals chart | 1d | Looks like real medical app |
| 4 | Doctor verified-badge + fees + rating | 2d | Trust floor |
| 5 | Post-visit email + 1-tap rating prompt | 1d | Compounds reviews |
| 6 | Patient audit-log screen | 1d | Trust + GDPR trivial |
| 7 | Re-book button + family profile switch polish | 1d | Reactivation |
| 8 | Cancel/reschedule UX + policy copy | 0.5d | 1-star review prevention |
| 9 | Empty/error/loading state pass | 2d | Silent retention killer |
| 10 | MFA (TOTP) for doctor accounts | 1d | Compliance + security |

Total quick-wins ~12 dev-days. Closes most P0/P1.

---

## Mistakes to Avoid

- **Launch 500 doctors, 0 patients.** Reverse. Soft-launch with 5–10 doctors + seeded patient flow.
- **Patient-only or doctor-only launch.** Two-sided market dead without both.
- **PII in logs.** Build scrub layer in platform before adding Sentry/PostHog.
- **Treating consent as one-time modal.** GDPR Art. 7(3) requires withdrawal as easy as grant.
- **Custom video stack.** Use vendor with BAA (Daily/Twilio).
- **Ignoring timezone/locale** for booking. Patient TZ must show.
- **No human support channel.** WhatsApp/email support = floor, not "contact form".

---

## What to Do Next (concrete sequence)

**Week 1 — unblock launch**
1. Wire SMS provider (Twilio w/ BAA) + FCM/APNs push. Replace `console.log` OTP in `auth.ts:629-634`.
2. Activate crons: `booking-reminders`, `dose-reminders`, `refill-reminders`, `vaccination-reminders` (exist, verify scheduled).
3. Add payment flow: `POST /payments` (Stripe), fee display on doctor profile + booking summary, cancellation policy copy before confirm.
4. Empty/error/loading state pass on mobile (`(app)` + `(doctor)` shells).
5. Cancel/reschedule polish + visible cancellation policy.

**Week 2 — trust + compliance**
6. Doctor verified-badge UI (use existing `slmcVerifiedAt`), profile completeness (specialty, years, hospital affiliation, fees).
7. Patient-visible audit log screen + DSAR UI.
8. TOTP MFA for doctor accounts (Lucia/better-auth TOTP plugin).
9. BAA inventory doc + breach runbook + named Privacy/Security Officer.
10. Log-scrubbing layer for PHI before adding Sentry/PostHog.

**Week 3 — credibility + polish**
11. Prescription PDF export + share-with-doctor link.
12. Vitals chart with trend line (use `vitals.ts:GET /series`).
13. Post-visit email summary + 1-tap rating prompt.
14. Doctor response-time badge on profile.
15. Re-book button + family profile switch polish.

**Week 4 — soft launch**
16. Onboard 5–10 doctors (mix specialties).
17. Seed 50 patient accounts, run both flows end-to-end.
18. App-store listing + landing page updates (privacy/security statement prominent).
19. Live support channel (WhatsApp Business or Intercom).
20. Monitor no-show rate, rating velocity, support tickets. Iterate.

**Out of MVP scope (track, don't build)**
- Video consult, AI triage, insurance, FHIR API, group chat, admin dashboard, lab/pharmacy/insurance/ambulance portals.

---

## Notes on Research

Cited: HIPAA Journal compliance checklist, GDPR-info.eu (Arts. 7, 17, 20, 33), Practo + Teladoc feature baselines, Simform healthcare app breakdown, FHIR Foundation.

Unreachable (403/404): KFF, Gartner, HBR, Mayo Clinic, NPI Registry, CMS PDF, Becker's. Conventions from 2026 domain consensus used instead.

Survey source: direct repo inspection. Routes, schema, recent commits all confirmed via Read/Glob.