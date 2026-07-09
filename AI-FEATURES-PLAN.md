# AI Features Plan — Healthcare MVP

Date: 2026-07-09
Scope: `/Users/thufailahamed/Downloads/App-2`

## Decisions locked

- **Scope:** Full 5-day plan (8 new features + safety floor)
- **Anthropic fallback:** auto-fallback, rate-limited (100 calls/day default, env-configurable)
- **Per-user rate limit on `/ai/*`:** 20 calls/user/hour, 429 with `retry-after`

## What already ships (do NOT rebuild)

5 AI features live, all on Cloudflare Workers AI Llama 3.3 70B:

| Feature | Route | Cost shape |
|---|---|---|
| Health chat (sync + SSE) | `/ai/chat`, `/ai/chat/stream` | per-message, 24h cache |
| Medical summary | `/ai/summary` | per-patient, cached |
| Lab report explain | `/ai/explain/lab-report[/stream]` | per-file, cached |
| Drug interaction | `/ai/drug-interaction` | curated table → LLM fallback |
| Prescription OCR | `/ai/ocr/prescription` | per-image, cached |
| Doc auto-classifier | `lib/classifier.ts` (background) | per-upload, threshold-gated |

**Mobile surfaces:** `apps/mobile/src/app/(app)/ai/{chat,summary,lab-explain,drug-check,ocr}.tsx`
**Portal surfaces:** `apps/marketing/src/portal/components/ai/{AiSummaryCard,AiExplainLabDrawer}.tsx`
**Infra:** PII redaction (`lib/redact.ts`), `ai_cache` + `ai_calls` tables, Workers AI→Anthropic router (`lib/ai/router.ts`).

## Cost shape (per-call estimates)

| Provider | 1k input | 1k output | Free tier |
|---|---|---|---|
| Workers AI Llama 3.3 70B | ~$0.0007 | ~$0.0028 | 10k neurons/day |
| Anthropic Sonnet (fallback) | $0.003 | $0.015 | none |

**Cached = $0.** With 24h TTL on `ai_cache` and redaction-first, 80%+ of calls are free at MVP volume.

## Tier 1 — Free / near-free (high ROI, low cost)

| # | Feature | Effort | Cost/call |
|---|---|---|---|
| 1 | Clinical-note auto-summary (SOAP-light) | 1d | <$0.005 |
| 2 | Symptom → record suggestion | 0.5d | <$0.003 |
| 3 | Prescription auto-translation en/si/ta | 0.5d | <$0.003 (3 cached results) |
| 4 | Duplicate-record detection (bge-small embeddings) | 1d | ~$0 (embeddings free) |
| 5 | Refill prediction (heuristic, no LLM) | 0.5d | $0 |
| 6 | Lab trend narrative | 0.5d | <$0.003 |
| 7 | Curated drug→food/allergy expansion (12→80) | 0.5d | $0 |
| 8 | Symptom-log anomaly flag (rule engine) | 0.5d | $0 |

## Tier 2 — Worth it, moderate cost

| # | Feature | Effort | Cost/call |
|---|---|---|---|
| 9 | Doctor-side SOAP note generator | 1.5d | ~$0.01 |
| 10 | Multi-visit narrative | 1d | ~$0.015 |
| 11 | Semantic doctor search (symptom→specialty) | 1d | ~$0.001 (embeddings) |
| 12 | Post-visit review tone classification | 0.5d | <$0.003 |

## Tier 3 — SKIP for MVP (cost/liability)

- Real-time AI symptom triage (Babylon precedent, FDA SaMD risk, MVP-REVIEW defers)
- Voice transcription (Whisper $/min, BAA scope, separate vendor)
- X-ray/imaging vision analysis (FDA, infrastructure)
- Custom fine-tuned models (premature, no data yet)
- Phone-bot / voice agent (different BAA, vendor: Twilio/Deepgram)

## Build order (5 days)

### Day 1 — Safety floor (BEFORE new features)
- **1.1** Anthropic fallback circuit breaker: env-configurable daily cap, default 100/day. Counter in D1 (or in-memory if simple). On cap hit → fail closed, return `fallbackXxx()`.
- **1.2** Per-user rate limit on `/ai/*`: 20 calls/user/hour, 429 + `retry-after`. D1 counter.
- **1.3** Rate-limit middleware that wraps all `/ai/*` routes (existing + new). New file: `apps/api/src/middleware/ai-rate-limit.ts`.
- **1.4** Telemetry: extend `ai_calls` writes with `provider: 'workers-ai' | 'anthropic' | 'cache' | 'fallback'` so we can see fallback hit rate in dashboard.

Files touched: `apps/api/src/lib/ai/router.ts`, `apps/api/src/middleware/ai-rate-limit.ts` (new), `apps/api/src/routes/ai.ts`, `apps/api/src/lib/ai.ts`, `apps/api/wrangler.toml`, `apps/api/tests/ai-rate-limit.test.ts` (new), `apps/api/tests/ai-router.test.ts` (extend).

### Day 2 — Tier-1 #1, #7 (free/near-free quick wins)
- **2.1** Clinical-note summary endpoint `POST /ai/clinical-note-summary` — accepts `{ noteText, patientId, visitId? }`, returns `{ summary, soap: { subjective, objective, assessment, plan }, keyTerms[] }`. 24h cache. Reuses `aiComplete`.
- **2.2** Mobile screen `apps/mobile/src/app/(app)/ai/clinical-note.tsx` (doctor-only? or both? — check).
- **2.3** Expand `DRUG_INTERACTIONS` table in `lib/ai.ts:447-512` from 12 → 80 pairs. No code logic change.

Files: `apps/api/src/routes/ai.ts` (extend), `apps/api/src/lib/ai.ts` (curated table), `apps/mobile/src/app/(app)/ai/clinical-note.tsx` (new), `apps/mobile/src/hooks/useApi.ts` (hook).

### Day 3 — Tier-1 #4, #6
- **3.1** Duplicate-record detection: on `POST /files/upload-with-record`, embed extracted text via Workers AI `@cf/baai/bge-small-en-v1.5`, store vector in new column on `medical_records` (JSON-encoded array). On insert, cosine-sim against last 50 records for that patient. If `>0.92` → flag in response `{ duplicate: true, of: <id> }`, do NOT insert duplicate. Mobile: confirmation modal "looks like a duplicate, keep both?".
- **3.2** Lab trend narrative: `GET /ai/lab-trend/:patientId?type=HbA1c` → pulls vitals/labs for that type, asks LLM for 1-paragraph plain-language trend. Cached per `(patientId, type)`.

Files: `apps/api/src/lib/ai/embeddings.ts` (new), `apps/api/src/routes/ai.ts` (extend), `apps/api/src/routes/files.ts` (hook), `packages/db/src/schema.ts` (add `embedding` JSON col on `medical_records` — check first if room), `apps/mobile/src/app/(app)/ai/lab-trend.tsx` (new).

### Day 4 — Tier-2 #9 (highest doctor value) + Tier-1 #5
- **4.1** SOAP note generator: `POST /ai/soap-note { patientId, noteText, doctorId }` → full SOAP. Reuses clinical-note plumbing with longer `maxTokens` (1500) + 7d cache.
- **4.2** Mobile + portal entry: doctor portal "Generate SOAP" button on visit detail.
- **4.3** Refill prediction: `GET /medicines/:id/refill-prediction` → computes days-since-last-fill, predicts refill date from dosage. Pure SQL + math. Optional LLM call ONLY for free-text instructions like "as needed" → pure heuristic edge-case.

Files: `apps/api/src/routes/ai.ts` (extend), `apps/api/src/routes/medicines.ts` (extend), `apps/marketing/src/portal/components/visits/SoapGenerator.tsx` (new), `apps/mobile/src/hooks/useApi.ts` (extend).

### Day 5 — Tier-1 #2, #8 + ship
- **5.1** Symptom → record suggestion: extend `/ai/chat` with optional `suggest: true` flag in response. If patient message resembles symptoms (vitals-relevant keywords), append `{ suggestion: { type: 'vitals', fields: [...] } }` to the response. Low cost, 1 extra prompt.
- **5.2** Symptom-log anomaly: scheduled cron (already wired? — verify) that scans `vitals` for threshold breaches in last 7d, pushes notification via existing `/notifications` route. Pure SQL.
- **5.3** Telemetry dashboard query: SQL view `v_ai_cost_daily` joining `ai_calls` by day+provider+model. Surface count, latency p50/p95, error rate, fallback rate. Add to admin route.

Files: `apps/api/src/routes/ai.ts` (chat extend), `apps/api/src/cron/vitals-anomaly.ts` (new), `apps/api/src/routes/admin-telemetry.ts` (new), `packages/db/src/schema.ts` (v_ai_cost_daily view via migration).

## Out of MVP (track, build post-launch)

- #3 prescription auto-translation
- #10 multi-visit narrative
- #11 semantic doctor search
- #12 review tone classification

## Verification

- `bun test` in `apps/api/` after each day (extend `ai-router.test.ts`, add `ai-rate-limit.test.ts`).
- Manual smoke: hit each new endpoint via curl with dev token, verify cache hit on 2nd call.
- Cost check: `SELECT provider, COUNT(*) FROM ai_calls WHERE created_at > NOW() - 1d GROUP BY provider;` should show 95%+ workers-ai or cache.

## Rollout

- Feature-flag each via `wrangler.toml` `[vars]` (e.g. `ENABLE_SOAP_NOTE=`) so we can kill-switch without redeploy.
- Ship Day 1 first (no new features, just guards). Day 2-5 each ship behind its own flag.
