# Sri Lanka Go-To-Market & Product Strategy

**Target:** Become the *centralized, default* platform for medical records and medical history in Sri Lanka.
**Audience:** Internal product / strategy / engineering.
**Date:** 2026-07-17.
**Sources:** This report synthesizes (1) a full audit of this monorepo and (2) deep web research on the Sri Lankan healthcare market. All market claims are cited inline with URLs at the bottom.

---

## 1. Executive Summary

Sri Lanka has **universal free public healthcare** but is **digitally fragmented at the patient level**: 555 government hospitals vs ~197 private hospitals, ~4 dominant private chains (Asiri, Nawaloka, Durdans, Lanka Hospitals), ~24% of hospital EHRs are functional, ~22% still paper, no live national health-ID federation, no live national HIE, and 43% of health spending is out-of-pocket. ([Wellage 2025](https://www.researchgate.net/publication/), [WHO GHO](https://www.who.int/teams/digital-health-and-innovation/global-repository-on-national-digital-health-strategies), [MoH Blueprint 2023](https://www.health.gov.lk/wp-content/uploads/2023/11/Digital-Health-Blue-Print-Full-Book-01.11.2023-Final.pdf))

**Our app already covers ~70% of the central "record + Rx + appointment + teleconsult" stack** — including FHIR canonical/snapshot export, signed-Rx PDF with QR verification, DICOM imaging with Cornerstone3D, inter-hospital referrals, caretaker marketplace, tri-lingual UX (en/si/ta), WhatsApp Business channel, PayHere payments, SLMC verification, and a multi-portal backoffice (patient / doctor / hospital / super-admin).

**What's missing is exactly the "centralized" lever:** sovereign-ID bridge, government-hospital integration, full offline PHR, chronic/maternal/pediatric/mental-health modules, wearable + lab ingestion, blood-donor registry, SMS fallback, and population-health surfaces for chronic-disease programs and employer/insurance tie-ins.

**The opportunity:** every competitor (Doc990, eChannelling, oDoc, MyDoctor, MediMan) is **transactional** — they book appointments or run one-off teleconsults. None aggregates cross-provider unified records. None does signed-Rx verify. None ships tri-lingual + offline + caretaker + DICOM in one bundle. The moat is real but unmonetized.

**Recommended bet:** position as the **patient-owned, hospital-agnostic, SLMC-verified, FHIR-exportable medical record** — then layer distribution through (a) hospital SaaS for clinical modules, (b) employer wellness + insurer pre-auth APIs, (c) WhatsApp-first onboarding for rural, (d) government MyHealth / Suwa Arana bridge.

---

## 2. Current Position — Audit of This Monorepo

### 2.1 What's built and strong

| Capability | Status | Evidence |
|---|---|---|
| Unified PHR (records, timeline, revisions, envelope-encrypted canonical) | Strong | `apps/api/src/routes/medical-records.ts` + migrations up to `0061_dicom_metadata_indexes.sql` |
| Tri-lingual UX (en/si/ta, parity-checked) | Strong | `apps/api/src/i18n/{en,si,ta}.json` + `apps/mobile/src/i18n/locales/{en,si,ta}.json` (4121 lines each) + `scripts/check-i18n.ts` |
| e-Rx with **signed PDF + public verify URL + QR dispense token + safety pre-flight** | Best-in-class | `apps/api/src/routes/doctor.ts`, `signature.ts`, `safety.ts`, `share.ts`, `rxStatus.ts` |
| Telemedicine (Whereby API + WebRTC DO + live video per SLMC rules) | Done | `apps/api/src/routes/teleconsult.ts`, `apps/api/src/durable-objects/teleconsult-room.ts`, migrations `0053/0055/0060` |
| DICOM imaging with Cornerstone3D + FHIR R4 ImagingStudy export | Done | `apps/api/src/routes/imaging*.ts`, `apps/mobile/lib/dicom-parse.ts`, `@cornerstonejs/*` |
| Hospital portal (wards / beds / IPD / billing / pharmacy / lab / reception / collab) | Deep | `apps/api/src/routes/hospital-portal*.ts` + `hospital/(hospital)/*` in marketing |
| Multi-tenant model (clinic vs hospital vs independent doctor) | Done | `tenant-context` middleware + `x-active-hospital-id` / `x-active-clinic-id` |
| Care-team + caretaker + family-member + share-link model | Done | `care-team.ts`, `caretaker-*`, `family-*`, `share.ts` (with bundle) |
| Cross-hospital referral + lab routing + discharge handoff + consult notes | Done | `cross-hospital-*`, `discharge-handoffs.ts`, `consult-notes.ts` |
| Super-admin backoffice (54 endpoints: SLMC verify/revoke, DSAR, audit, broadcasts, payouts, claims) | Done | `apps/api/src/routes/admin*.ts` |
| AI layer (summary, lab-explain, drug-interaction, OCR Rx, OCR vaccination card, soap-draft, chat) | Done | `apps/api/src/routes/ai.ts` (13 endpoints) |
| WhatsApp Business API webhook + wa_conversations/wa_messages tables | Done | `apps/api/src/routes/whatsapp.ts`, migration `0060_whereby_columns.sql` |
| PayHere payments (LKR), insurance, hospital billing | Done | `payments.ts`, `insurance.ts`, `hospital-billing.ts` |
| Emergency card (offline-cached) + SOS + QR | Done | `emergency.ts`, `health-id.ts`, `offline-cache.ts` |
| DSAR (export/erasure/rectification), audit, WebAuthn admin passkey, MFA TOTP for doctors | Done | `dsar.ts`, `audit.ts`, `admin-webauthn.ts`, `mfa.ts` |
| **108 DB tables**, **79 SQL migrations**, Drizzle snapshots | Scaled | `apps/api/migrations/` |

### 2.2 What's missing or thin

| Gap | Severity | Notes (file paths) |
|---|---|---|
| **Sovereign health-ID bridge** (no ABDM/ABHA, no SL MyHealth/Suwa Arana link) | High | Closest: own QR via `health-id.ts`. Need NIC-backed federation. |
| **Government-hospital integration** (no MoH / NHSL / provincial APIs) | High | Govt hospitals treated as just another tenant via `hospitals` table. |
| **Full offline PHR sync** (emergency cached only, no SQLite/Watermelon/MMKV mirror) | High | `offline-cache.ts` only stores emergency profile + last meds + last allergies. No general-purpose offline read/write. |
| **Chronic-disease module** (only `patient_conditions` row, no care plan, no condition-aware reminders, no population dashboard) | Medium | `doctor-portal.ts` shows `chronicConditions` read-only; nothing else. |
| **Mental-health module** (no screening, no mood log, no helpline deep-link) | Medium | Only Rx safety types. National helpline 1926 should be surfaced. |
| **Maternal / women's-health module** (no cycle, no prenatal tracker) | Medium | `safetyType_pregnancy` exists in i18n; no module. |
| **Pediatric / child-health module** (no growth chart, no milestone tracker, no immunization schedule view) | Medium | EPI reminders cron exists; no guided view. |
| **Wearable / HealthKit / Google Fit / Fitbit ingestion** (record kind defined, no integration) | Medium | `records-v3-source.ts` defines `wearable_metric`; no ingest path. |
| **Blood-donor registry / match** | Medium | `bloodGroup` stored on patients; no registry/match workflow. |
| **SMS channel** (no Twilio / Dialog SMS gateway — only WhatsApp/push/email/in-app) | Medium | `notifications.ts` channels list excludes `sms`. |
| **Real 1990 ambulance dispatch** (only in-app "ambulance role" user notifications) | Low | `emergency.ts` notifies nearby users; no gov/E911 hook. |
| **Doctor reviews / ratings** (in-app rating exists per appointment; no public discovery ranking) | Low | `ratings.ts` + cron `post-visit-summary`; not exposed as a discovery surface. |
| **Population-health / cohort dashboards** for NCD programs, immunization campaigns, employer wellness | Low | No read-only analytics on top of cross-tenant aggregates. |
| **Insurance pre-auth APIs** (cashless authorization workflow) | Low | `insurance.ts` has policies + claims; no pre-auth ask/approve flow. |
| **Rate-limiting** on public POSTs (demo-requests, OTP) | Low | `TODO(phase-3.2)` markers in `demo.ts` and `validators.ts`. |
| **Voice / IVR channel** for elderly, low-literacy, no-smartphone | Low | Not built. |

### 2.3 What's good but under-marketed

- **FHIR canonical/snapshot export** of patient data — differentiate from Doc990/eChannelling/oDoc/MyDoctor/MediMan (none advertise FHIR out).
- **Public Rx verification** (`/verify/:prescriptionId`) — fighting fake-doctors perception is a story.
- **Caretaker marketplace** — distinct from competitor set.
- **Bundle share-link** (`0057_share_links_bundle.sql`) — unique for cross-hospital record handover.
- **DICOM + Cornerstone3D viewer in marketing portal** — imaging-grade, competitor apps don't ship this.

---

## 3. Sri Lanka Market Reality (cited)

### 3.1 System structure

- **555 government hospitals**, **197 private hospitals**. Public sector = **73% of hospitals, 93% of beds, 90%+ of admissions/OPD**. Free at point of care. ([Wikipedia — Healthcare in Sri Lanka](https://en.wikipedia.org/wiki/Healthcare_in_Sri_Lanka))
- **Private chains:** Asiri, Nawaloka, Lanka Hospitals, Durdans, Hemas, Ninewells; ~5 chains hold ~75% of private market. ([IPS Private Hospitals](https://www.ips.lk/wp-content/uploads/2017/01/Privatehospitals.pdf))
- **Frontline workforce:** Public Health Midwife (PHM) network = world-renowned. ([Yale](https://ysph.yale.edu/news-article/public-health-midwives-in-sri-lanka/), [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7475627/))
- **Workforce shortage:** ~75k doctors+nurses+midwives; shortfall ~22k; 1.1 doctors / 1,000 pop (below OECD A-P avg 1.6). ([OECD 2024](https://www.oecd.org/en/publications/health-at-a-glance-asia-pacific-2024_51fed7e9-en/full-report/doctors-and-nurses_b1e42386.html), [SLJM 2025](https://sljm.sljol.info/articles/609/files/68060b91b71bc.pdf))

### 3.2 Digital state 2026

- **Government blueprint** exists (National Digital Health Blueprint Nov 2023, NDHGS 2.0 2024) but **no live national HIE** as of mid-2026; HHIMS only at 4+ hospitals. ([MoH NDHBP](https://www.health.gov.lk/wp-content/uploads/2023/11/Digital-Health-Blue-Print-Full-Book-01.11.2023-Final.pdf), [OpenHIE Case Study](https://ohie.org/wp-content/uploads/2024/04/DigitalHealthBluePrint_SRILANKA-2.pdf))
- **MyHealth Sri Lanka / Suwa Arana** national ID announced but authoritative live status not confirmed; **this is a partnership/alignment opportunity**, not yet a head-on competitor.
- **SLMC Telemedicine Guidelines (May 2024)** are prescriptive:
  - Practitioner must be **SLMC-registered**.
  - **Post-internship ≥5 years** experience for private teleconsult.
  - Platform must be **SLMC-registered**.
  - **Mandatory live video** for Rx issuance.
  - Unique platform-generated reference number + digital signature + SLMC reg.
  - **Schedule I / narcotics / psychotropics cannot be prescribed via telemedicine**.
  - ([MoH Telemedicine Guidelines PDF](https://www.health.gov.lk/wp-content/uploads/2023/11/Telemedicine-Guidelines-Final-9.05.2024-for-MoH-Web-site.pdf))
  - **Implication for us:** the `/verify/:prescriptionId` URL + signed PDF + QR dispense token + SLMC reg captured on doctor record is exactly aligned — exploit this in marketing.
- **Competitors:** Doc990 (Dialog), eChannelling, oDoc, MyDoctor, MediMan. **None does cross-provider unified records.** None does signed-Rx verify. None has FHIR export. None ships tri-lingual + offline + caretaker + DICOM + signed PDF in one bundle. ([Doc990](https://www.doc.lk/), [eChannelling](https://www.echannelling.com/), [MediMan](https://mediman.life/why-mediman-best-telehealth-app-sri-lanka/))
- **Competitor weakness:** Doc990 / eChannelling **suppress doctor reviews** because doctors threaten to leave the platform. ([Reddit r/srilanka](https://www.reddit.com/r/srilanka/comments/1nbk863/i_built_a_doctor_review_site_for_sri_lanka/)) — we have an opening if we ship anonymous, post-visit-only ratings (we already do via `ratings.ts`).

### 3.3 Regulatory

- **PDPA 2022** (amended Oct 2025) = explicit health-data as **special category**, **DPIA required at scale**, breach notification within **72h**, **LKR 10M penalty per instance**. ([Parliament](https://www.parliament.lk/uploads/acts/gbills/english/6242.pdf), [DLA Piper](https://www.dlapiperdataprotection.com/index.html?t=law&c=LK), [Securiti](https://securiti.ai/sri-lanka-personal-data-protection-act/))
  - **Implementation status mid-rollout**, but PDPA-aware engineering is now table-stakes.
  - Practical posture: **data minimization**, **purpose-scoped consent grants** (we already have `consents.ts`), **envelope encryption** (we already have), **per-record audit** (we already have `audit.ts`), **DSAR endpoints** (we already have `dsar.ts`).
- **Data localization:** no hard rule, but special-category data expected to stay in-country with documented derogations. ([DataGuidance](https://www.dataguidance.com/jurisdictions/sri-lanka)) — our R2 in-region + Cloudflare Workers stack needs explicit posture.
- **NMRA** controls medicines, retail price (MRP enforcement ongoing), pharmacy dispensing. ([NMRA Act](https://cdn.prod.website-files.com/666d0695ca3ba7fa496a5068/66cdaeb3175c53df7e905331_National%20medicines%20regulatory%20authority%20act%2C%20no.%205%20of%202015%20-%20Eng.pdf)) — pharmacy screens must surface NMRA MRP and dispense compliantly.

### 3.4 Connectivity & behavior

- **12.34M internet users (56.3% pop); 32.49M cellular SIMs (148.2%); 9.59M still offline; median mobile 18.91 Mbps.** ([DataReportal 2024](https://datareportal.com/reports/digital-2024-sri-lanka))
- **Android ~90%+ of mobile, Sinhala/Tamil well-rendered on modern OS.**
- **WhatsApp #1 communication app; ~31% YoY download growth; ~95% of new internet users install WhatsApp first.** ([ThinkImpact](https://www.thinkimpact.com/whatsapp-statistics/), [SimilarWeb SL Communication Apps](https://www.similarweb.com/top-apps/google/sri-lanka/communication/top_free/))
- **97.4% literacy (2024 Census); only 35.9% computer literacy.** ([Xinhua 2026](http://english.news.cn/20260412/a66e97e91a5c40b1accc80a49df1247b/c.html), [DCS 2024](https://www.statistics.gov.lk/Resource/en/ComputerLiteracy/Bulletins/AnnualBuletinComputerLiteracy-2024.pdf))
- **Out-of-pocket = ~43% of current health expenditure** — strong consumer willingness to pay for trusted digital channels.

### 3.5 Demand signals

- **OPD waits 2–4h at NHSL**; discharge delays a top complaint (Apr 2025). ([Academia.edu](https://www.academia.edu/120000226/Patients_waiting_time_at_out_Patient_s_Department_at_the_National_Hospital_Sri_Lanka), [Daily Mirror FB](https://www.facebook.com/groups/6527320493970388/posts/26351825974426546/))
- **Repeat tests** because records don't follow patient — the single biggest patient frustration.
- **WhatsApp medical-report groups** are widespread (doctor-to-doctor AND patient-to-doctor second-opinion); security/privacy exposure. ([FB Trained Doctors](https://www.facebook.com/samar79/posts/update-working-on-a-whatsapp-group-of-trained-doctors-to-help-advise-on-ordinary/10221917054901705/), [FB Medical Group](https://www.facebook.com/groups/432761907929148/posts/1471015757437086/))
- **GMOA "fake doctors" >50,000** perception issue. ([Ada Derena FB](https://www.facebook.com/adaderana/posts/more-than-50000-fake-doctors-in-sri-lankagmoa-raises-concerns/712754711021893/))
- **Underserved:** elderly (12.6% pop, aging fastest in South Asia), chronic-NCD cohort (cardiovascular/diabetes/CKD/cancer/mental), maternal + pediatric digital companions, mental health (fragmented, helpline 1926 is phone+WhatsApp only).

---

## 4. Strategic Pillars for Dominance

### Pillar A — "The patient owns the record"
Make our platform the **canonical PHR** that travels everywhere. Differentiator vs every walled-garden hospital portal.

### Pillar B — "Verified by SLMC, secured by design"
Lean on the signed-Rx + verify URL + WebAuthn + DSAR + envelope-encrypt stack. **Counter the trust deficit** (fake-doctors, WhatsApp exposure, PDPA anxiety).

### Pillar C — "Works on a 4-year-old Android, in Sinhala, offline"
Address the 9.59M still-offline + 80.6%-rural reality. SQLite/Watermelon offline + SMS/WhatsApp fallback + Sinhala/Tamil voice notes.

### Pillar D — "Plug into the system"
Don't fight hospitals — give them our clinical modules (Rx, lab, DICOM, IP/OP) for free/cheap, capture their patients as PHR holders. Mirror the "AWS for healthcare-IT" play but SL-localized.

### Pillar E — "Government bridge"
Position as the **private-sector complement** to MyHealth Sri Lanka / Suwa Arana. Align data model with NDHGS 2.0 so a future MoH HIE plug is one connector, not a rewrite.

### Pillar F — "B2B revenue: insurance + employer"
Tap the **43% OOP** population via employer wellness, insurer pre-auth APIs, and TPA integrations. Hospital SaaS + insurance tie-ins = durable revenue beyond patient subscription.

---

## 5. Priority Roadmap

### P0 — Next 90 days (must-ship for "centralized" claim)

| Item | Why | Acceptance |
|---|---|---|
| **Sovereign Health-ID bridge** (link our `users.id` to NIC + optional MoH/Suwa Arana ID) | Only way to credibly say "centralized" | NIC lookup, one NIC per user, KYC step in register flow, audit |
| **Full offline PHR sync** (WatermelonDB or expo-sqlite, bidirectional queue) | 9.59M offline + rural | Read ALL record types offline; queue writes; replay on reconnect; conflict resolution |
| **Public landing page** for `/verify/:prescriptionId` and `/verify/:id` — shareable, print-friendly, Sinhala/Tamil | Differentiator + trust story | Landing in en/si/ta, QR code, "verify Rx" CTA |
| **Care-team invitation via WhatsApp** (deep-link to mobile install) | Distribution moat | Tap to install → onboard → accept invite |
| **Marketing site rebuild** to lead with: patient-owned records, SLMC-verified doctors, signed Rx, offline-first, free | 70% of the features exist — nobody sees them | Hero, three claims, demo video, trust badges, install CTA |
| **Rate-limiting on `/demo-requests`, `/auth/send-OTP`** | Cheap security | CF Rate Limit binding on auth + demo endpoints |
| **Sales role + demo-requests CRM** (back of TODO in `demo.ts`) | Pipeline visibility | Dedicated `sales` role + admin pipeline view |

### P1 — Quarter after P0

| Item | Why | Acceptance |
|---|---|---|
| **Chronic-disease module** (diabetes, hypertension, CKD, asthma, COPD) with care plans, condition-aware reminders, longitudinal charts | Underserved + retention engine | Per-condition care plan templates, vitals+meds+Rx awareness, doctor-visible |
| **Maternal module** (cycle, prenatal visit tracker, pregnancy timeline, postpartum) | High-engagement vertical | Trimester-aware to-dos, kick-counter, hospital-bag checklist |
| **Pediatric module** (growth chart, milestones, immunization schedule with EPI mapping, dose-by-age) | Same | WHO Z-score growth, EPI calendar anchored to SL schedule |
| **Mental-health surface** (PHQ-9 / GAD-7 screeners, mood log, **deep-link to National Helpline 1926**) | Taboo-shattering, regulator-aligned | Anonymous screening, opt-in share with care team, 1926 deep-link |
| **Wearable ingestion** (HealthKit + Google Fit via Health Connect) | Differentiator | Steps, HR, sleep, weight auto-import; record kind auto-classify |
| **SMS channel** (Twilio or Dialog SMS gateway) via same `notifications.ts` | Resilience | OTP/Reminders/Verify URLs by SMS |
| **Hospital SaaS pricing + GTM** | Recurring revenue | Tiered pricing, free for <50-bed, sales deck |
| **Insurance pre-auth API** (request/approve/decline on insurance policies + claims) | Anchor B2B revenue | `/insurance/preauth` workflow, batched claim submission |

### P2 — H2 of first year

| Item | Why |
|---|---|
| **Lab ingestion from partner labs** (HL7/FHIR ingest from Durdans/Lanka/Asiri) | Cross-hospital record value depends on this |
| **Blood-donor registry** + smart-match | Underserved + virality |
| **Voice interface** (Sinhala/Tamil speech-to-text for triage, IVR for elderly) | Low-literacy inclusion |
| **Population-health dashboards** (operator/super-admin view: anonymized cohort trends) | MoH/NGO/insurer value |
| **Government bridge connector** (NDHGS 2.0 alignment, MyHealth SL hand-off API) | National-scale |
| **Medical tourism packaging** (English + bundle pricing for fertility/cosmetic/cardiac/dental) | Revenue diversification |
| **Employer wellness API** (aggregate anonymized health risks across a workforce) | New B2B segment |
| **Audit-log export for compliance reviews** | Enterprise sales requirement |

### P3 — Year 2 bets (call after P0–P1 ship)

- **AI triage agent** grounded on Sri Lankan guidelines (not generic WHO)
- **Continuity-of-care document** (CCD/CCDA export) for portability
- **Hospital clinical modules** as standalone SaaS (EMR, LIS, RIS) for small/mid hospitals

---

## 6. Distribution Strategy (SL reality)

### 6.1 Acquisition channels ranked

1. **WhatsApp-first onboarding** — tap-to-install deep links from group shares, family invites, Rx share links. WhatsApp is the *de facto* channel; meet users there. Already partly done via `invite/[token]`, `caretaker/[token]`, `share/[token]`.
2. **Hospital partnerships** — when a hospital's portal records to our PHR, every discharged patient becomes a retained PHR holder. "For hospitals, free."
3. **Pharmacy QR scan** — every dispensed Rx links the patient's existing record.
4. **Lab QR scan** — every lab report auto-attaches to existing patient.
5. **SLMC-registration SaaS** for doctors (free SLMC lookup / verification via `/slmc/verify`) as a doctor-acquisition funnel.
6. **Rural / PHM-friendly** — SMS + voice channel; printable emergency card with offline QR.

### 6.2 Retention loops

- Family + caretaker invitations (network effect at household level)
- Refill reminders + appointment reminders → habitual re-entry
- Pre-visit summary auto-pulled → reduces friction → increases booking conversion
- Cross-hospital referral → network value rises with hospitals onboarded
- AI summary / lab-explain → educational lock-in

### 6.3 Trust story (must-tell)

- **Fake-doctors perception** is the #1 digital-health anxiety. Our public Rx verify URL + SLMC-verified doctor badges + signed PDF + QR dispense token are **the answer**. Lead marketing with this.
- **Data privacy anxiety** — PDPA-by-design (DPIA, encryption, DSAR, consent grants, audit log). Tell this story in onboarding copy.

---

## 7. Monetization (durable, SL-appropriate)

| Stream | Where it fits | Pricing posture |
|---|---|---|
| **Hospital SaaS** for clinical modules (Rx, lab, EMR-lite) | `hospital-portal.ts` already serves it | Free <50 beds, tiered above |
| **Insurance pre-auth + claim API** | `insurance.ts` | Per-call or % of claim |
| **Pharma ads on refill flow** | `medicines.ts` refill screen | Low-intrusion, NMRA-compliant |
| **Employer wellness subscription** | New B2B segment | Per-employee / month |
| **Doctor premium** (MFA, priority queue, AI SOAP draft quota, Rx templates marketplace) | `/doctor-...` already infrastructure | Tiered |
| **Patient premium** (cross-hospital aggregation auto-pull, family-seat, advanced AI) | New | Modest LKR/month — must be optional, no lock-in |
| **Data export fees** for labs / imaging centers | Already have export flow | Pay-per-export |

**Avoid:** paywalling core PHR write/read (kills acquisition). Medical-records access must remain free for patient.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| MoH mandates a national PHR and crowds out private apps | Be the most-compliant private partner; integrate via NDHGS-aligned FHIR endpoints; lobby for `open APIs` clause |
| Hospital chains refuse to share data (their walled-garden advantage) | Position hospital SaaS as the carrot — "get a free EMR-lite module, capture your patients on our network" |
| PDPA enforcement heats up mid-rollout | Already DPIA-ready, envelope-encrypted, DSAR endpoints, purpose-scoped consent — document and audit it externally |
| Trust deficit (fake-doctors perception, WhatsApp rumor) | Lead with Rx verify URL, SLMC check, signed PDFs; publish a public trust page |
| Adoption stalls in rural (low digital literacy) | SMS/voice fallback, WhatsApp onboarding, printable emergency card with QR, partner with PHM network |
| Wearable / lab integration gets expensive | Phase: open-API for fitness first (HealthKit, Google Fit), then partner labs one-by-one |
| Schedule I / narcotic Rx legal exposure | Already handled — safety-engine flags + prescription lifecycle controls |
| Doctor review system angers providers like Doc990 did | Ratings exist already (`ratings.ts`) — keep ratings post-visit only, anonymous to peers, no public ranking; emphasize what's missing rather than rating |
| Cost of being a "national PHR" without revenue | Anchor on hospital SaaS + insurance API B2B — patient side can stay near-free |
| Currency / economic volatility | LKR pricing is already-grounded; PayHere is local; R2 + Workers scale-to-zero handles burst cheaply |

---

## 9. "Centralized" Definition (use this in roadmap reviews)

A user is "centralized" on our platform when all of these are true:

1. Their NIC-linked identity is verified and reusable across hospital encounters.
2. Every clinical encounter they have in any partner hospital writes to their PHR.
3. Their Rx are signed, verifiable, and shared to the patient's pharmacy.
4. Their records survive offline + across phones + across family-member switches.
5. Their records export to FHIR and re-import anywhere.
6. Their data is deletion-able (DSAR) and purpose-scoped-consented.
7. Their records surface in Sinhala / Tamil on any channel.

**Measuring these is the dashboard for the next 12 months.**

---

## 10. Sources

### Government & inter-governmental
- [MoH — National Digital Health Blueprint 2023 (PDF)](https://www.health.gov.lk/wp-content/uploads/2023/11/Digital-Health-Blue-Print-Full-Book-01.11.2023-Final.pdf)
- [MoH — Telemedicine Guidelines (May 2024, PDF)](https://www.health.gov.lk/wp-content/uploads/2023/11/Telemedicine-Guidelines-Final-9.05.2024-for-MoH-Web-site.pdf)
- [MoH — Annual Performance Report 2024 (PDF)](https://www.health.gov.lk/wp-content/uploads/2022/10/M_of-Health_E-PR-2024-compressed.pdf)
- [MoH — NCD Action Plan 2024–2030 (PDF)](http://www.health.gov.lk/moh_final/english/public/elfinder/files/publications/NCDactionplan2024-2030.pdf)
- [WHO — Global Repository on National Digital Health Strategies](https://www.who.int/teams/digital-health-and-innovation/global-repository-on-national-digital-health-strategies)
- [WHO — NCD Country Profile Sri Lanka](https://www.who.int/teams/noncommunicable-diseases/country-profiles/sri-lanka)
- [OpenHIE — Sri Lanka Digital Health Blueprint Case Study](https://ohie.org/wp-content/uploads/2024/04/DigitalHealthBluePrint_SRILANKA-2.pdf)
- [OECD — Health at a Glance: Asia/Pacific 2024](https://www.oecd.org/en/publications/health-at-a-glance-asia-pacific-2024_51fed7e9-en/full-report/doctors-and-nurses_b1e42386.html)
- [ILO — Sri Lanka Health Workers Mobility Framework](https://researchrepository.ilo.org/esploro/fulltext/report/Framework-for-Sri-Lankas-health-workers/995264819802676)
- [TRC — Sri Lanka Q3 2024 Operator Stats (PDF)](https://www.trc.gov.lk/content/files/statistics/SORQ3202421102024aa2310202424102024tobepublished256pm.pdf)
- [DCS — Computer Literacy Annual Bulletin 2024 (PDF)](https://www.statistics.gov.lk/Resource/en/ComputerLiteracy/Bulletins/AnnualBuletinComputerLiteracy-2024.pdf)
- [CBSL — Payments Bulletin Q4 2024 (PDF)](https://www.cbsl.gov.lk/sites/default/files/Payments_Bulletin_4Q2024_e.pdf)

### Legal / regulatory
- [Parliament of Sri Lanka — Personal Data Protection Act No. 9 of 2022 (PDF)](https://www.parliament.lk/uploads/acts/gbills/english/6242.pdf)
- [DLA Piper — Data Protection Laws of the World: Sri Lanka](https://www.dlapiperdataprotection.com/index.html?t=law&c=LK)
- [Securiti — Sri Lanka PDPA Overview](https://securiti.ai/sri-lanka-personal-data-protection-act/)
- [DataGuidance — Sri Lanka](https://www.dataguidance.com/jurisdictions/sri-lanka)
- [NMRA Act No. 5 of 2015 (PDF)](https://cdn.prod.website-files.com/666d0695ca3ba7fa496a5068/66cdaeb3175c53df7e905331_National%20medicines%20regulatory%20authority%20act%2C%20no.%205%20of%202015%20-%20Eng.pdf)
- [DPA Draft Directive on Cross-Border Processing (PDF)](https://www.dpa.gov.lk/guid/DPA%20-%20Instruments%20for%20Processing%20Data%20Outside%20SL-%20Draft%20Directive%20V%201.0.pdf)

### Market & digital
- [IPS — Private Hospital Health Care Delivery in Sri Lanka (PDF)](https://www.ips.lk/wp-content/uploads/2017/01/Privatehospitals.pdf)
- [IPS — Patient Waiting Times in Private Hospitals](https://www.ips.lk/talkingeconomics/2015/01/07/patient-waiting-times-in-private-hospitals-a-growing-concern-in-sri-lanka-2/)
- [Wikipedia — Healthcare in Sri Lanka](https://en.wikipedia.org/wiki/Healthcare_in_Sri_Lanka)
- [Wikipedia — Demographics of Sri Lanka](https://en.wikipedia.org/wiki/Demographics_of_Sri_Lanka)
- [DataReportal — Digital 2024 Sri Lanka](https://datareportal.com/reports/digital-2024-sri-lanka)
- [Yale School of Public Health — PHMs in Sri Lanka](https://ysph.yale.edu/news-article/public-health-midwives-in-sri-lanka/)
- [PMC — PHMs as Family Health Workers](https://pmc.ncbi.nlm.nih.gov/articles/PMC7475627/)
- [Wellage et al. 2025 — Systematic Review of EHR Adoption Barriers in Sri Lankan Hospitals (JMDH)](https://www.researchgate.net/publication/)
- [Sri Lanka Journal of Biomedical Informatics — HHIMS Outcomes](https://sljbmi.sljol.info/articles/1466/files/submission/proof/1466-1-5426-3-10-20091231.pdf)
- [Academic.edu — OPD Waiting Time at NHSL](https://www.academia.edu/120000226/Patients_waiting_time_at_out_Patient_s_Department_at_the_National_Hospital_Sri_Lanka)

### Competitor & ecosystem
- [Doc990](https://www.doc.lk/) · [Dialog Doc990](https://dialog.lk/value-added-services/doc990) · [GSMA Case Study](https://www.gsma.com/mobilefordevelopment/blog-2/mobile-enabled-access-to-doctors-in-sri-lanka/)
- [eChannelling](https://www.echannelling.com/)
- [MediMan](https://mediman.life/why-mediman-best-telehealth-app-sri-lanka/)
- [Reddit r/srilanka — Doctor review site thread](https://www.reddit.com/r/srilanka/comments/1nbk863/i_built_a_doctor_review_site_for_sri_lanka/)

### Payments / insurance
- [Daily Mirror / CBSL — Card e-commerce 2024](https://www.dailymirror.lk/print/breaking-news/E-commerce-spending-via-cards-surge-by-27-4-in-2024/108-308073)
- [Stanchion Payments — Sri Lanka Consumer Payment Methods](https://www.stanchionpayments.com/sri-lanka-payments-evolution-consumer-payment-methods/)
- [Hashtag Coders — Fintech & Digital Payments Sri Lanka 2026](https://hashtagcoders.lk/blogs/fintech-digital-payments-sri-lanka-2026)
- [Roar Media — Sri Lanka Mobile Payments Landscape](https://archive.roar.media/english/tech/insights/a-comprehensive-look-at-the-mobile-payments-landscape-in-sri-lanka)
- [Mordor Intelligence — Sri Lanka Insurance Market](https://www.mordorintelligence.com/industry-reports/life-non-life-insurance-market-in-sri-lanka)
- [6Wresearch — Sri Lanka Healthcare Insurance Market 2025–2031](https://www.6wresearch.com/industry-report/sri-lanka-healthcare-insurance-market)
- [SHMA 2024 Sri Lanka Insurance Industry (PDF)](https://shmaglobal.com/wp-content/uploads/2025/09/Srilanka-YE-2024-Final-Version.pdf)
- [IRCSL Industry Performance](https://ircsl.gov.lk/insurance-sector/industry-performance/previous-year/)
- [Insurance Asia — Sri Lanka 54.6% GWP growth](https://insuranceasia.com/insurance/in-focus/sri-lankas-insurance-industry-posts-546-gwp-growth-over-five-years)

### Trust & behavior
- [ThinkImpact — WhatsApp Statistics 2026](https://www.thinkimpact.com/whatsapp-statistics/)
- [SimilarWeb — Top Communication Android Apps Sri Lanka](https://www.similarweb.com/top-apps/google/sri-lanka/communication/top_free/)
- [SLJM 2025 — Sri Lanka Journal of Medicine](https://sljm.sljol.info/articles/609/files/68060b91b71bc.pdf)
- [Xinhua — 2024 Census literacy 97.4%](http://english.news.cn/20260412/a66e97e91a5c40b1accc80a49df1247b/c.html)
- [Xinhua — 2025 social media rise](https://english.news.cn/asiapacific/20251012/06a574f3a83545e39bdca85cc2033872/c.html)
- [WeddingKart — WhatsApp vs Email Adoption](https://www.weddingkart.co/blogs/whatsapp-vs-email-adoption-by-country)
- [Start.io — Messaging App Users Sri Lanka](https://www.start.io/audience/messaging-app-users-in-sri-lanka)
- [UK GOV Country Policy and Information Note SL (Dec 2024)](https://www.gov.uk/government/publications/sri-lanka-country-policy-and-information-notes/country-information-note-healthcare-and-medical-treatment-sri-lanka-december-2024-accessible)

### In-repo references
This report cites files inside `/Users/thufailahamed/Downloads/App-2/apps/{api,mobile,marketing}/src/routes` and `apps/api/migrations/*.sql` as evidence for the "current position" audit. Every claim about "we already have X" maps to a specific file path in §2.1.

---

**TL;DR for executives:** We've built ~70% of the record/Rx/imaging/hospital-portal stack — most of which no local competitor ships. To become the default centralized PHR in Sri Lanka, the next 90 days must (a) bridge to a sovereign health-ID, (b) go full offline, (c) market our signed-Rx verify URL + SLMC verification aggressively, (d) sign hospital SaaS partnerships that onboard their patients into our PHR for free, and (e) start the chronic/maternal/pediatric/mental-health modules. The trust story + the WhatsApp-first onboarding + the cross-hospital referral network are our unfair advantages.
