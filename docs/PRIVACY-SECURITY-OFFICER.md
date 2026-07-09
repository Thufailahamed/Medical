# Privacy / Security Officer

## Role

The Privacy/Security Officer (PSO) is the single accountable owner for
HealthHub's data-protection posture. Reports to the CEO. Has direct
escalation authority to the Board for any P1/P2 incident.

This is a placeholder role description pending a named hire. Until a
human is in seat, the **default delegate is the CTO**, with backup
delegation to the Head of Engineering.

## Responsibilities

### Day-to-day

1. Maintain `docs/COMPLIANCE.md` — vendor inventory, BAA status,
   retention policies, encryption posture.
2. Approve any new vendor that touches PHI before integration ships.
3. Run the monthly compliance review (KEK rotations, DSAR backlog,
   audit-log retention).
4. Approve access to production PHI-bearing systems (read replicas,
   raw D1 exports, KEK material).
5. Review the weekly anomaly scan (`jobs/audit-archive.ts`,
   `audit_logs` mass-access detector).

### Incident response

1. Own the regulatory clock for any breach (60d HIPAA, 72h GDPR, PDPA
   "as soon as practicable").
2. Convene the incident call within 30 minutes of a P1/P2 trigger.
3. Coordinate with Legal on regulator + patient notification wording
   before external send.
4. Sign off on the postmortem + remediation plan.

### Patient-rights requests (DSAR)

1. Triage incoming DSAR requests within 5 business days.
2. Verify identity (NIC + DOB + OTP), then dispatch to fulfillment.
3. Export / erase endpoints are owned by Eng; the PSO verifies the
   output before it is delivered.

### Vendor management

1. Maintain BAA / DPA inventory (see `docs/COMPLIANCE.md` §1).
2. Send renewal reminders 90/60/30 days before expiry.
3. Audit vendor SOC reports annually.

## Escalation matrix

| Trigger | First call | Backup |
|---|---|---|
| P1 breach (≥50 records PHI exfil) | PSO + CTO + Legal | CEO |
| P2 breach (suspected/single record) | PSO + CTO | Legal |
| KEK compromise / leak | PSO + Eng Lead on-call | CTO |
| DSAR identity-spoofing attempt | PSO + Legal | n/a |
| Regulator inquiry | PSO + Legal + CEO | CTO |
| Audit-log tamper attempt | PSO + Eng Lead | CTO |

## Contact (placeholder)

- **Primary:** TBD — `privacy@healthhub.app`
- **Backup:** CTO (current holder: `cto@healthhub.app`)
- **Out-of-hours paging:** PagerDuty rotation `privacy-sec-oncall`

## Reporting cadence

| Audience | Frequency | Format |
|---|---|---|
| CEO | Monthly | 1-page status memo (vendor risks, incidents, DSAR backlog) |
| Board | Quarterly | Slide deck + KPI table |
| Engineers | Per-incident | Postmortem + action items |
| Public | Annually | Transparency report (incidents, breach stats, DSAR volume) |

## Handoff checklist (named hire)

When a human fills this seat, walk through:

1. `docs/COMPLIANCE.md` — full read; flag any disagreement.
2. `wrangler.toml` — list every secret + which env it belongs to.
3. `apps/api/src/lib/envelope-crypto.ts` — KEK lifecycle + rotation flow.
4. `apps/api/src/lib/mfa.ts` — TOTP envelope, recovery-code hashing.
5. `apps/api/src/lib/logger.ts` — PII redaction patterns + log-scrubbing policy.
6. `apps/api/migrations/` — list every schema change touching PHI.
7. Run a tabletop exercise: simulate a P2 breach using `docs/COMPLIANCE.md`
   §2.4 timeline; verify each role's contact + paging path works.

## Open items

- Named Privacy/Security Officer (legal/HR — pending post-MVP).
- Board approval of this charter.
- Public-facing email (`privacy@healthhub.app`) — set up before launch.
- Tabletop exercise scheduled — first one due within 60 days of launch.