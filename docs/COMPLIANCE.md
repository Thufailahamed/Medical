# HealthHub Compliance Posture

> **Scope:** MVP launch in Sri Lanka. Covers HIPAA-equivalent (Sri Lanka
> Personal Data Protection Act 2022) + GDPR floor. This document is a
> working posture summary, not legal advice. Final BAA execution
> requires named counsel.

## 1. Vendor / Sub-processor Inventory (BAA tracking)

Every vendor below handles PHI either at-rest (Cloudflare R2/D1, S3-style
buckets), in-transit (Workers / push notifications), or via
identity-binding surface (SMS OTP, push). A Business Associate
Agreement (BAA) is required where the vendor touches PHI on our behalf.

| Vendor | Data Touched | BAA Status | Renewal | Owner | Notes |
|---|---|---|---|---|---|
| **Cloudflare** — Workers | Compute, logs (PHI-scrubbed) | MSA signed, BAA pending | Annual | Eng Lead | Workers requests terminate at CF edge; PHI must never appear in `console.log` (use `lib/logger` scrubber). |
| **Cloudflare** — D1 (SQLite) | PHI at rest, encrypted columns | MSA signed, BAA pending | Annual | Eng Lead | Field-level AES-256-GCM on `medical_records.encrypted_payload` (KEK env `RECORD_KEK_PRIMARY`). |
| **Cloudflare** — R2 | PHI attachments, prescriptions | MSA signed, BAA pending | Annual | Eng Lead | Signed URLs only; bucket is private; lifecycle rule → cold after 90d. |
| **Cloudflare** — Email Routing | Inbound patient email → D1 | MSA signed, BAA pending | Annual | Eng Lead | Forwarding only; no PHI storage. |
| **Cloudflare** — Workers AI | De-identified free text → triage | MSA signed, BAA pending | Annual | Eng Lead | Strict "no PHI in prompts" guardrail in `lib/safety-runner.ts`. |
| **SMSLenz** (Sri Lanka) | Phone OTP delivery | BAA + DPA signed | Annual | Comms Lead | SL gateway for OTP; phone numbers are PII — masked in logs via `lib/redact.ts`. |
| **PayHere** (Sri Lanka) | Patient payment data | DPA + privacy policy agreed | Annual | Finance | We do **not** receive card numbers; PayHere hosts checkout and posts a token. |
| **Resend** (transactional email) | OTP + notifications | DPA signed via Resend ToS | Annual | Comms Lead | TLS enforced; no PHI beyond first-name + OTP code (PHI scrubbed in logs). |
| **Expo / Apple / Google** | Push notifications | Each platform ToS; no formal BAA | n/a | Eng Lead | Push payload contains notification text only; deep-link IDs are opaque. |
| **OpenAI / Anthropic** (if used for AI features) | De-identified text only | API DPA via vendor ToS | Annual | Eng Lead | Hard ban on PHI in prompts; tokenized input pipeline planned post-MVP. |

**Action:** Open BAA tracks with Cloudflare Account Manager + SMSLenz
sales within 30 days of launch. PayHere + Resend rely on standard
online DPA acceptance.

## 2. Breach Response Runbook

### 2.1 Severity ladder

| Severity | Trigger | Response time | Who |
|---|---|---|---|
| **P1** | Confirmed PHI exfiltration or unauthorized access to >50 records | Immediate (≤15 min page-out) | Incident Commander + CTO + Privacy/Security Officer + Legal |
| **P2** | Suspected PHI exposure, single-record loss, credential compromise | ≤1 h acknowledgement | Incident Commander + Privacy/Security Officer |
| **P3** | Internal policy violation, anomalous access pattern, no confirmed PHI leak | ≤24 h | Privacy/Security Officer |
| **P4** | Process gap / near-miss, internal-only signal | ≤72 h | Privacy/Security Officer |

### 2.2 Roles

- **Incident Commander** — coordinates response, owns the timeline.
- **Privacy/Security Officer** — owns the regulatory clock + external notifications.
- **Eng Lead on-call** — owns technical containment (revoke tokens, rotate KEKs, patch CVE).
- **Comms Lead** — owns patient/regulator messaging.
- **Legal** — owns regulator notification wording.

### 2.3 Regulatory clocks

- **HIPAA (US patients if any, 45 CFR §164.404):** ≤60 days from
  discovery to individual notification; ≤60 days to HHS for ≥500
  records (immediate media notice in affected states).
- **GDPR (EU patients):** ≤72 hours from awareness to supervisory
  authority (Art. 33); "without undue delay" to data subjects
  (Art. 34) when risk is high.
- **Sri Lanka PDPA 2022 (§33):** "as soon as is reasonably practicable"
  to the Data Protection Authority + affected data subjects.
- **Operational SLA:** Acknowledge in paging system ≤15 min from
  trigger; first incident call within 60 min; external notifications
  cleared by Legal before send.

### 2.4 Timeline template

```
T+0     Incident detected (alert, report, or anomaly)
T+15m   Page-out Incident Commander
T+30m   First incident call: confirm scope, classify severity, scope blast radius
T+1h    Containment action: revoke affected tokens, rotate KEKs, lock sub-processor
T+4h    Forensic capture: log snapshot, query snapshot, audit-log diff
T+24h   Internal status memo to exec team; draft regulator notice
T+72h   Latest GDPR/PDPA notification deadline
T+60d   Latest HIPAA individual-notification deadline (if P1)
T+90d   Postmortem + remediation plan + policy update
```

### 2.5 Evidence checklist

- Audit-log dump for affected `userId` / `resourceId` (D1 `audit_logs`).
- Cloudflare Workers request logs (PII-scrubbed, sanitized slice).
- D1 row snapshots before/after incident.
- Source-control diff pinning the change that introduced the issue.
- Signed KEK rotation log (lib/envelope-crypto.ts rewrap events).

### 2.6 External notification template (skeleton)

```
Subject: Important security notice about your HealthHub account

We are writing to inform you of a security incident that may have
affected your personal health information stored in HealthHub.
On [DATE], we identified [DESCRIPTION]. We have [CONTAINMENT].
The data potentially involved: [CATEGORIES, e.g. "your prescription
record from 2026-01-15"]. We have [REMEDIATION STEPS, e.g. "rotated
the encryption keys, invalidated active sessions, notified the
Data Protection Authority"].
We recommend you [STEPS, e.g. "change your password, review your
audit log"]. Contact us at security@healthhub.app.
— HealthHub Privacy/Security Officer
```

## 3. Audit log retention

| Class | Retention | Storage |
|---|---|---|
| Clinical audit (`audit_logs.resource IN medical_record, prescription, …`) | 6 years | D1 hot (90d) → R2 cold |
| Operational audit (auth, MFA, payment) | 1 year | D1 hot only |
| Application logs (`console.*` output, PII-scrubbed) | 30 days | Workers tail / logpush |
| Breach evidence bundles | 6 years post-resolution | R2 immutable bucket |

Quarterly cron (`jobs/audit-archive.ts`) moves rows older than 90d to
the cold bucket; old D1 rows are deleted only after a successful
upload + checksum.

## 4. Encryption at rest + in transit

- **At rest:** Field-level AES-256-GCM (`lib/envelope-crypto.ts`)
  on `medical_records.encrypted_payload`, `doctors.signing_private_key_enc`,
  `doctors.mfa_secret_enc`. KEKs read from env (`RECORD_KEK_PRIMARY`,
  `DOCTOR_KEY_KEK`, `MFA_SECRET_KEK`); KEKs themselves are never
  persisted to the DB.
- **In transit:** TLS 1.2+ enforced at CF edge (automatic).
  Internal Workers ↔ D1/R2 is TLS via CF backbone.
- **Mobile ↔ API:** TLS 1.2+; JWT in `Authorization: Bearer …` header;
  no PHI in URL query strings for `/medical-records`, `/prescriptions`,
  `/audit`.

## 5. Patient rights mapping (GDPR Art. 7, 17, 20, 33; PDPA §26–§31)

| Right | Endpoint | Notes |
|---|---|---|
| Right to be informed | Privacy policy + first-launch consent screen | `apps/mobile/src/app/(app)/consent.tsx` |
| Right of access (Art. 15) | `GET /dsar/export` | Full PHI bundle, AES-encrypted download |
| Right to rectification | `PATCH /medical-records/:id` (doctor only) | Audit-stamped |
| Right to erasure (Art. 17) | `POST /dsar/erase` | Soft-erase + tombstone for audit trail |
| Right to restrict processing | `PATCH /consent` | Sets processing scope per data category |
| Right to data portability (Art. 20) | `GET /dsar/export` | Same endpoint as access |
| Right to object (Art. 21) | `PATCH /consent` | Toggles analytics + AI processing |
| Right not to be subject to automated decision-making | UI banner + opt-out | Default-off for AI features |
| Breach notification (Art. 33/34) | Runbook §2 | See timeline |

## 6. Audit cadence

| Cadence | Activity |
|---|---|
| Weekly | Audit log anomaly scan (mass-access detector) |
| Monthly | KEK rotation status, BAA renewal status, DSAR queue |
| Quarterly | Penetration test, third-party compliance review |
| Annually | Full policy refresh, BAA renewal cycle, named officer rotation |

## 7. Open items

- BAA execution with Cloudflare + SMSLenz (in flight).
- Named Privacy/Security Officer (legal/HR — see `PRIVACY-SECURITY-OFFICER.md`).
- Full HIPAA certification vs compliance floor (deferred — see MVP-REVIEW.md).
- HITRUST CSF + SOC 2 Type II (post-MVP, gated on enterprise pipeline).