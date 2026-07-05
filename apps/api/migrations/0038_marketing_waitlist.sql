-- Migration 0038: marketing-site waitlist
--
-- Phase 1 of the marketing site (https://healthhub.app). Captures
-- public waitlist sign-ups from the landing page so we can roll
-- the private beta out in measured waves (1,000 spots initially).
--
-- Design notes:
--   * No auth — anyone with an email can sign up. That's the
--     whole point of a waitlist.
--   * Email is the unique key. Dedupe is the responsibility of
--     the unique index, not the application — the API can
--     return 200 on duplicate and treat it as "already on the
--     list" so the marketing form never errors visibly.
--   * `role` is a free-text enum that matches the `<select>`
--     options in index.html: patient | doctor | hospital.
--     We keep it as text (not an SQLite CHECK) so adding new
--     roles to the form is a no-op migration-wise.
--   * `source` is a free-form tag the API passes through so we
--     can split utm_source / landing variant / etc. without
--     a schema change.
--   * `referrer` is best-effort — bots and most privacy-mode
--     browsers send empty, that's fine.
--   * `invited_at` stays NULL until we manually invite them
--     (or until a CF cron promotes top-N to invited). The
--     marketing dashboard reads it to know who still needs
--     a slot.
--   * No PII beyond email + role. We do NOT capture the IP —
--     CF logs already have it for abuse handling.
--
-- Why a separate table and not piggyback on demo_requests?
--   demo_requests is doctor/clinic qualified leads with SLMC,
--   clinic size, message body, and a sales-pipeline status.
--   The waitlist is a different funnel (consumer, top-of-funnel,
--   mass-market). Conflating them in the admin would mean
--   sales deals sitting next to "I just want to try the app"
--   noise. Different table, different admin filter, different
--   export.

CREATE TABLE IF NOT EXISTS `marketing_waitlist` (
  `id` TEXT PRIMARY KEY,
  `email` TEXT NOT NULL,
  `role` TEXT NOT NULL DEFAULT 'patient',
  `source` TEXT,
  `referrer` TEXT,
  `user_agent` TEXT,
  `invited_at` TEXT,
  `invited_slot` INTEGER,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);--> statement-breakpoint

-- Case-insensitive dedupe: SQLite stores TEXT as-is so two
-- submissions of "Foo@bar.com" and "foo@bar.com" would both
-- hit the unique index. The application normalises to lowercase
-- + trim before insert (see routes/marketing.ts); the index
-- enforces the resulting canonical form.
CREATE UNIQUE INDEX IF NOT EXISTS `marketing_waitlist_email_unique` ON `marketing_waitlist` (`email`);--> statement-breakpoint

-- Admin list query: "show everyone waiting, newest first,
-- excluding the ones we've already invited." Putting invited_at
-- first in the index lets SQLite do a fast range scan for the
-- common "still waiting" filter (`invited_at IS NULL`).
CREATE INDEX IF NOT EXISTS `idx_marketing_waitlist_pending` ON `marketing_waitlist` (`invited_at`, `created_at`);--> statement-breakpoint

-- Source attribution — useful when running multiple landing
-- pages or campaign variants. Cheap to maintain, hard to add
-- later without backfill.
CREATE INDEX IF NOT EXISTS `idx_marketing_waitlist_source` ON `marketing_waitlist` (`source`, `created_at`);
