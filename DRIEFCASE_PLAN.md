# Driefcase-Style Plan for Sri Lanka

> Source: deep research (5 angles, SL context, 103 agents). Reference model = DRiefcase (India) — adapted for SL.
> Stack: Expo mobile + Hono on Cloudflare Workers + D1/Drizzle + Supabase auth (Bun monorepo).

---

## 1. Why This Works in Sri Lanka

**Confirmed market reality (June 2026):**

| Finding | Implication |
|---|---|
| **No mature SL consumer PHR exists.** Asiri, Durdans, Hemas all web-portal only — no mobile app, no EMR access, no telemedicine. | **Blue ocean.** No incumbent to displace. |
| **Government digital infra is sparse.** MoH landing page has 1999 trilingual hotline only — no EMR/PHR/telemedicine content. **No ABDM/ABHA equivalent.** | We must build our own identity layer (NIC-based). |
| **Trilingualism is mandatory.** MoH operates SI/TA/EN. Durdans Sinhala Agrahara page. Official Language Act: SI + TA official, EN as link language. | **SI/TA/EN from day 1**, not retrofit. |
| **Agrahara + Suraksha are live B2B billing channels.** NITF-empanelled private hospitals (Asiri, Durdans, Nawaloka, Hemas, Ninewells, Ceylon Hospitals, Lanka Hospital). | **Distribution + reimbursement partners available Day 1.** |
| **Driefcase model proven.** Consumer PHR + WhatsApp onboarding + clinician SaaS + national health ID linkage. | Direct playbook — substitute NIC for ABDM/ABHA. |

---

## 2. Pillar Adaptations: India → Sri Lanka

| India Pillar (DRiefcase) | Sri Lanka Adaptation |
|---|---|
| **ABDM/ABHA** (NHA national health ID) | **NIC** (existing national ID, 10-digit "V" format incl. NIC, DOB, gender) — no health-specific equivalent yet. Use NIC as proxy identity. Watch for SL National Digital Health Blueprint. |
| **Aadhaar OTP verification** | **NIC + mobile OTP** (no biometric mandated yet for digital health). Optional: Department of Registration of Persons NIC verification API (public-facing lookup exists for banks). |
| **WhatsApp Business API** (Meta/Gupshup) | **Same** — WhatsApp penetration in SL > 90%, Sinhala + Tamil stickers/UI supported. Same providers work. |
| **"Smart Auto-Tagging"** | **Same** — OCR pipeline (Sinhala/Tamil + English). Workers AI or Google DocAI for Sinhala script. |
| **Family health locker** | **Same + extended.** Multi-generational families common in SL; relationship is the value prop. |
| **Driefcase Connect (B2B)** | **Doctor/Clinic SaaS.** SL has ~25,000 registered doctors (SLMC). Pitch tagline translates: "You studied medicine to do data entry? Let someone do it for you." |
| **Partner offers (corporate + health)** | **Same + Agrahara/Suraksha integration.** These are *insurance schemes*, not just offers — deeper B2B moat. |
| **PMJAY (govt insurance for poor)** | **Agrahara (public servants) + Suraksha (students).** Cashless portable coverage at empanelled private hospitals. **Wedge into NITF partnership.** |

---

## 3. Critical Gaps in Our App (SL context)

Our repo has the consumer health-locker bones — most building blocks exist.

| Already have | Status | SL fit |
|---|---|---|
| Medical records + files + timeline | ✅ done | direct fit |
| Family management | ✅ done | direct fit, multi-gen common |
| Vaccination tracker | ✅ done | SL EPI schedule (BCG, DPT, MMR, HPV, JE) — different templates than India |
| Doctor + hospital portals | ✅ done | fit for SL chains (Asiri/Durdans/Hemas/Nawaloka) |
| Emergency (SOS + QR) | ✅ done | direct fit (no India-specific 112 emulation needed) |
| Walk-ins | ✅ done | fit |
| Labs + vitals + allergies + doses + notes | ✅ done | fit |
| AI + chat + push + notifications | ✅ done | fit |

**Critical SL-specific gaps:**

| Gap | Priority | Notes |
|---|---|---|
| **Trilingual UI (SI/TA/EN)** | **P0** | Day 1. Not retrofit. Use `i18next` + Unicode SI/TA fonts. |
| **NIC-based identity layer** | **P0** | 10-digit NIC + DOB verification (DOB acts as 2nd factor). No health-specific ID exists. |
| **WhatsApp-first onboarding** | P0 | Same pattern as DRiefcase. Critical in SL — app-install friction high outside Colombo. |
| **Email-to-record ingestion** | P1 | Same as DRiefcase. Many SL labs still email PDFs. |
| **Auto-classification (OCR)** | P1 | Workers AI or Google DocAI. Must support SI/TA scripts. |
| **B2B clinic SaaS ("Connect SL" equivalent)** | P1 | Separate `.doctor` subdomain. Pitch: friction-removal for SL clinicians. |
| **Vaccination reminders (push)** | P2 | SL EPI schedule + private-sector add-ons (HPV, JE endemic regions). |
| **Agrahara / Suraksha claims integration** | P2 | NITF partnership = revenue + distribution. Long sales cycle but high moat. |
| **Public hospital OPD queue data** | P3 | Would need MoH partnership — long-term. Out of MVP. |
| **Telemedicine (SLMC-regulated)** | P3 | Regulatory landscape not yet clear — see open questions. |

---

## 4. Phased Roadmap (30 weeks)

### Phase 1 — Trilingual MVP + Identity + Distribution Moat (Weeks 1-6)

**1.1 Trilingual infrastructure (P0)**
- Add `i18next` + `react-i18next` to `apps/mobile`.
- Locale files: `si.json`, `ta.json`, `en.json` in `apps/mobile/src/i18n/`.
- All existing screens get `t('key')` rewrite. Components that display dates/numbers use `Intl.DateTimeFormat` with locale.
- Sinhala/Tamil Unicode fonts bundled (system fonts usually fine on iOS/Android).
- Add `LocaleSwitcher` component → persisted in Zustand auth store.
- API: `Accept-Language` header → Zod schemas already in `packages/shared` get optional translated error messages.

**1.2 NIC-based identity layer (P0)**
- Extend `apps/api/src/routes/auth.ts` — register/login flow: email/mobile + NIC + DOB (DOB = soft 2FA).
- Drizzle: `users` table gets `nic` column (unique, indexed) + `date_of_birth` + `nic_verified_at`.
- `packages/shared` Zod schemas: `nicSchema` (10 digits, "V" or "old 9-digit" formats), `dobSchema`.
- Mobile auth flow: Step 1 NIC → Step 2 DOB picker → Step 3 mobile OTP (using `push.ts` / Twilio/Hutch/Dialog gateway) → Step 4 email confirm → Done.
- **No biometric or gov API dependency in MVP** — NIC + DOB is "soft verified" (pending Agrahara/Suraksha hard verification later).
- Privacy: NIC stored hashed (bcrypt) at rest; plain only in session token claims.

**1.3 WhatsApp-first onboarding (P0)**
- New `apps/api/src/routes/whatsapp.ts` — webhook for Meta Cloud API or Gupshup.
- Conversation state machine in D1: `welcome → language_pick (si/ta/en) → nic_capture → dob_capture → mobile_otp → email_optional → done`.
- Trilingual bot templates (Meta/WhatsApp Business supports SI/TA).
- Mobile CTA: `wa.me/94XXXXXXXXX?text=Hi` deep-link — replaces generic auth landing button.
- Queue: Cloudflare Queue for async OTP delivery + state transitions.

**1.4 Email-to-record ingestion (P1)**
- Dedicated inbox: `records@<our-domain>` (Cloudflare Email Routing → Worker).
- Worker → parse attachments (PDF, JPG, PNG, HEIC) → R2 → Queue → classification pipeline.
- Auth: subject line matches NIC or registered email → file → user's locker.
- Same architecture as DRiefcase, but no ABDM tokens — just NIC match.

### Phase 2 — Smart Locker (Weeks 7-12)

**2.1 Auto-classification pipeline (P1)**
- Cloudflare Queue → Workers AI (Llama 3.2 Vision) or Google DocAI → extract: `doc_type` (lab report, prescription, discharge summary, X-ray, ECG, invoice), `date`, `provider`, `patient_name`, `key_findings`.
- Index in D1 FTS5 (`records_fts` virtual table) — trilingual tokenization via Unicode-aware FTS5 tokenizer.
- Schema: `record_classifications(record_id, doc_type, language, confidence, extracted_json, indexed_at)`.
- Mobile: trilingual Smart Search bar.

**2.2 Vaccination reminders (P2)**
- Extend `vaccinations` route with `due_date`, `reminder_sent_at`, `schedule_template_id`.
- Templates: **SL EPI schedule** (BCG @ birth, OPV/ Pentavalent @ 2/4/6 months, MMR @ 9/12/15 months, JE in endemic areas, HPV for adolescents) — JSON in `packages/shared/src/vaccines-sl.ts`.
- Cloudflare Cron daily 9am IST → push notifications via existing `push.ts`.

**2.3 Family locker UX**
- Existing `patients/:id/family` works — surface as **Family tab** with switch-active-member pattern.
- Share-with-family via existing `share.ts`.

**2.4 Lab partner integration (P1, wedge)**
- SL private labs (Hemas, Nawaloka, Asiri labs) **email PDFs to patients** — most common flow today.
- Convert this pain point into our wedge: email forwarding instructions "Forward your lab reports to records@<our-domain>".
- Partnership ask: lab prints our QR on receipt — patient scans → auto-link to report.

### Phase 3 — B2B Clinic SaaS (Weeks 13-20)

**3.1 Connect SL — `<our-app>.doctor` (P1)**
- Subdomain via separate Cloudflare Worker route.
- Pitch (trilingual): **"You studied medicine to do data entry? Let someone do it for you."**
- Doctor features:
  - In-app camera upload (Expo Camera) → auto-classify → file under patient NIC.
  - Email-to-upload (same worker as 1.4, doctor-specific inbox).
  - E-form patient check-in (share link → patient fills SI/TA/EN history before visit).
  - E-prescription (PDF, structured).
  - Appointment reminders (SMS + WhatsApp).
  - Multi-role (receptionist, assistant, doctor) credentials.

**3.2 SLMC compliance**
- SLMC regulates telemedicine, prescribing, doctor registration. Must integrate SLMC registration validation.
- Add `slmc_registration_no` to `doctors` table — verified against SLMC public directory.

**3.3 Sales motion**
- Request-a-Demo form on `.doctor` subdomain.
- SL has dense private clinic network in Colombo suburbs — solo GPs and small polyclinics first.

### Phase 4 — Monetization (Weeks 20+)

**4.1 B2B SaaS pricing (Connect SL)**
- Solo doctor: Rs LKR X/mo
- Polyclinic (up to 5 doctors): Rs LKR Y/mo
- Small hospital: custom quote.
- Billing: **PayHere** (Sri Lanka's Razorpay equivalent — local B2B billing + recurring) or Stripe Atlas.

**4.2 Agrahara / Suraksha partnership (P2, biggest moat)**
- Partner with NITF: "Patients on Agrahara/Suraksha can auto-link their policy to our app — cashless claim filing, digital locker integrated with hospital empanelment list."
- Negotiate revenue share on cashless flow.
- **Why this matters:** These schemes cover millions of SL citizens. Being an approved app = regulatory moat = incumbent-trumping.

**4.3 Partner offers (consumer side, no consumer fees)**
- `/offers` page — corporate + health partners.
- Teleconsult partner (target: SL Rs 199/yr equivalent ≈ Rs LKR 990/yr or LKR 8/day).
- Lab partner: 10-20% off packages for app users.

**4.4 Pharmacy / diagnostics bundles (PharmEasy playbook, P3)**
- Out of scope unless we pivot. SL pharmacy retail is fragmented (Rajya Osusala, State Pharmacies, private chains) — hard to bundle cleanly.

---

## 5. Tech Mapping to Our Stack

| DRiefcase feature | Our implementation | SL notes |
|---|---|---|
| National health ID | NIC + DOB → hashed at rest | No SL equivalent of ABDM yet |
| WhatsApp webhook | `apps/api/src/routes/whatsapp.ts` + D1 state machine | Meta Cloud API or Gupshup |
| Email ingestion | Cloudflare Email Worker → R2 → Queue | Native CF |
| OCR / classification | Workers AI + Google DocAI for SI/TA | Start Workers AI, escalate DocAI for SI script |
| Full-text search | D1 FTS5 virtual table, Unicode-aware tokenizer | Trilingual tokenization |
| Trilingual UI | i18next + Intl APIs | Bundled |
| Push notifications | Existing `push.ts` | Extend with reminder cron |
| File storage | R2 | Replace any S3 |
| SMS/OTP delivery | Twilio (intl) or Dialog/Mobitel/Hutch gateway | Investigate Dialog SMS Gateway |
| Vaccination schedules | SL EPI JSON in `packages/shared` | SL-specific |
| B2B subdomain | Separate Worker route (`*.doctor.<domain>`) | Reuse `apps/api` w/ feature flag |
| Payments (B2B) | PayHere (SL-native) or Stripe | UPI doesn't apply; LKR + cards |
| Cron jobs | Cloudflare Cron Triggers | Reminders, NIC verifications |
| Gov scheme integration | Agrahara/Suraksha API (NITF) — none public yet | B2B partnership play |

---

## 6. Open Questions (from research)

These could not be confirmed from public sources — need direct outreach:

1. **SL telemedicine regulation** — does SLMC have a final telemedicine guidelines document? Determines if we can offer teleconsult feature.
2. **NIC verification API** — is there a programmatic NIC lookup (Department of Registration of Persons)? Or rely on DOB + mobile OTP soft-verification only?
3. **National Digital Health Blueprint (Sri Lanka)** — does MoH have a public digital strategy document? If yes, our identity layer needs to align.
4. **NITF Agrahara API access** — does NITF provide empanelled-hospital list + member verification? Or PDF-only?
5. **PayHere vs Stripe for recurring LKR billing** — cost & currency conversion impact?

---

## 7. Risks & Costs

| Risk | Mitigation |
|---|---|
| Trilingual content is *expensive to seed* (medical terms in SI/TA) | Crowdsource via SL medical student community; partner with university translation dept |
| Sinhala OCR accuracy | Workers AI + Google DocAI fallback; allow manual classification override |
| NIC as soft identity (no gov API) means dup accounts | DOB + mobile OTP + device fingerprint as soft-2FA; escalate to Agrahara/Suraksha hard verification once partnered |
| WhatsApp Business API cost (per-conversation, USD) | Use Gupshup (cheaper for India/SEA region); budget ~LKR 1.50/inbound msg |
| SMS gateway (Dialog/Mobitel/Hutch) fragmentation | Twilio intl gateway first; switch to local gateway for cost |
| Agrahara/Suraksha sales cycle slow | Phase 4 only after traction proven; partner via warm intros from Asiri/Durdans if they're already on platform |
| LKR currency volatility | USD-pegged pricing for B2B plan or annual contracts; PayHere handles FX |
| Workers CPU limits (10ms free, 30s paid) | Auto-classification needs paid plan + Queue async |

**Estimated infra cost at 100k SL users:**
- Cloudflare Workers Paid: ~$5/mo
- R2 storage: ~$15/mo (smaller per-user footprint than India — less record volume)
- WhatsApp Business: ~LKR 50k/mo at 20k conversations
- Workers AI: ~$30/mo at 100k inferences
- PayHere: 2% of B2B GMV
- **Total: < $200/mo + WhatsApp costs** — extremely capital-efficient.

---

## 8. Success Metrics (SL-tuned)

- **Phase 1 (week 6):** 1k NIC-verified users, 500 WhatsApp-onboarded, 100 SI/TA screen-rendered correctly
- **Phase 2 (week 12):** 10k MAU, 60% records auto-classified, SI/TA OCR > 85% accuracy on lab PDFs
- **Phase 3 (week 20):** 50 clinic accounts on Connect SL, LKR 5L/mo B2B ARR
- **Phase 4 (week 30):** 50k MAU, 500 clinic accounts, LKR 50L/mo total ARR, **NITF partnership signed**

---

## 9. Immediate Next Actions (this week)

1. Add `i18next` to `apps/mobile/package.json` + bootstrap trilingual `t()` wrapper in `_layout.tsx`.
2. Extend `packages/db/src/schema.ts` with `nic`, `date_of_birth`, `nic_verified_at` on `users`.
3. Scaffold `apps/api/src/routes/abdm.ts` (rename or create `sl-identity.ts`) for NIC + DOB flow.
4. Set up WhatsApp Business API account (Meta or Gupshup).
5. Build Email Worker stub → R2 bucket → Queue.
6. Outreach: NITF, MoH Digital Health unit, Dialog/Mobitel/Hutch SMS gateway, PayHere.
7. Draft SL EPI vaccination JSON for `packages/shared`.
8. Internal demo: NIC-based registration end-to-end.

---

## 10. Why We Win

- **Blue ocean SL:** No local PHR competitor, no incumbent to displace.
- **Trilingual advantage:** Foreign players (Driefcase, etc.) cannot easily localize to SI/TA. Native team = moat.
- **Agrahara/Suraksha moat:** B2B gov-scheme integration = regulatory + distribution lock-in competitors can't replicate without SL partnership groundwork.
- **Proven model:** DRiefcase blueprint de-risks product design. Just substitute ABDM → NIC.
- **Capital-efficient:** < $200/mo infra at 100k users. Cloudflare-native stack scales gracefully.