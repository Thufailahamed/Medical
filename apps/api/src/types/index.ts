import type { DB } from "../lib/db";
import type { Locale } from "../lib/locale";
import type { users } from "@healthcare/db";

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: string;
}

export interface AppEnvironment {
  Bindings: {
    DB: any;
    R2: any;
    AI: Ai;
    ENVIRONMENT: string;
    DEV_MODE: string;
    /** When "true", POST /auth/login accepts dev-doctor@healthhub.local + password `dev` and auto-seeds. */
    ALLOW_DEV_SEED?: string;
    JWT_SECRET?: string;
    CRON_SECRET?: string;
    // Phase 1.4: domain hosting email aliases for Phase 1.4 ingestion.
    // e.g. "records.healthhub.app" — used in the address handed to users.
    EMAIL_ALIAS_DOMAIN: string;
    // Phase 2.1: confidence threshold for auto-classification upgrades.
    // Default 0.6. Cron uses CLASSIFY_CRON_THRESHOLD (default 0.7).
    CLASSIFY_THRESHOLD?: string;
    CLASSIFY_CRON_THRESHOLD?: string;
    // Phase 2.3.2: invite landing page. PUBLIC_URL is the web origin
    // where recipients without the app installed see the HTML summary.
    // Store URLs are placeholders until the app is published.
    PUBLIC_URL?: string;
    IOS_APP_STORE_URL?: string;
    ANDROID_PLAY_STORE_URL?: string;
    // Phase 1.3: WhatsApp onboarding webhook. WA_VERIFY_TOKEN is the
    // value pasted into Meta's dashboard when registering the webhook;
    // WA_ACCESS_TOKEN is a Meta system-user token with
    // whatsapp_business_messaging scope. The bot phone_number_id is read
    // per-message from the inbound payload so it does not need to be
    // configured here.
    WA_VERIFY_TOKEN?: string;
    WA_ACCESS_TOKEN?: string;
    // Phase 4: SMS OTP via SMSLenz (or console fallback).
    SMS_PROVIDER?: string;       // "smslenz" | "console"
    SMSLENZ_USER_ID?: string;    // From SMSLenz dashboard
    SMSLENZ_API_KEY?: string;    // Secret
    SMS_SENDER_ID?: string;      // e.g. "HealthHub" or "SMSlenzDEMO"
    // Round 4: In-App Video Teleconsultation. `TELECONSULT_ROOM` is the
    // Durable Object namespace binding registered in wrangler.toml.
    // TURN_URLS is a JSON-encoded string array of `turn:` URIs (set via
    // `wrangler secret put TURN_URLS`); TURN_USERNAME / TURN_CREDENTIAL
    // are the REST-auth credentials. Defaults to Google STUN only when
    // TURN_URLS is unset — symmetric-NAT clients will fail to connect.
    TELECONSULT_ROOM: DurableObjectNamespace;
    TURN_URLS?: string;
    TURN_USERNAME?: string;
    TURN_CREDENTIAL?: string;
    WHEREBY_API_KEY?: string;

    // Round 6: TOTP MFA for doctors (lib/mfa.ts). Wraps the per-user
    // TOTP seed and the recovery-code pepper with their own KEKs so a
    // DB-only leak doesn't yield usable authenticator seeds. /mfa
    // returns 503 when either is missing.
    MFA_SECRET_KEK?: string;
    MFA_RECOVERY_PEPPER?: string;

    // Round 6: doctor signing keypair KEK (lib/signing.ts). Aliases
    // RECORD_KEK_PRIMARY for legacy deploys; lib/signing.ts reads
    // DOCTOR_KEY_KEK first. Wraps each doctor's RSA private key in
    // the doctors table.
    DOCTOR_KEY_KEK?: string;
    RECORD_KEK_PRIMARY?: string;

    // Round ADM-3: KV binding that stores WebAuthn passkey challenges
    // across isolate restarts. Currently the in-memory map in
    // routes/admin-webauthn.ts is used; production must wire the
    // [[kv_namespaces]] binding so passkey challenges survive.
    WEBAUTHN_KV?: KVNamespace;

    // Round 7: outbound email provider key (Resend). When missing the
    // email channel falls back to console — fine for dev, broken in
    // prod. /auth/send-otp logs the code rather than sending.
    RESEND_API_KEY?: string;

    // Round 7: PayHere (Sri Lanka B2B gateway) credentials. /payments
    // returns 503 when both are missing.
    PAYHERE_MERCHANT_ID?: string;
    PAYHERE_SECRET?: string;

    // Round 8: AI provider keys. The router in lib/ai/router.ts
    // prefers Workers AI on the free tier; Anthropic Sonnet is the
    // paid fallback; Gemini powers structured extraction. Each is
    // independently optional — the router falls back automatically.
    ANTHROPIC_API_KEY?: string;
    GEMINI_API_KEY?: string;
  };
  Variables: {
    user: User;
    userId: string;
    dbUser: typeof users.$inferSelect;
    userRole: string;
    db: DB;
    locale: Locale;
    // Phase ADM-4: JWT audience claim (mobile | admin). Used by
    // `requireAdmin` to reject mobile-issued tokens from reaching
    // admin endpoints.
    aud?: string;
    // Impersonation context — populated by authMiddleware when the
    // request carries an `impersonatedBy` claim. Audit middleware
    // stamps these into row details so the real operator is recorded.
    actorId?: string;
    impersonatedBy?: string;
    impName?: string;
    // Used by requireAdmin so handlers can read the actor + IP.
    adminActor?: typeof users.$inferSelect;
    clientIp?: string | null;
    // Caretaker Profiles: resolved by caretaker-context middleware.
    // The patientId the caretaker is currently acting on behalf of
    // (verified against active patient_links rows). Empty string
    // when not in caretaker mode or no principal is active.
    activePrincipalPatientId?: string;
    activeCaretakerLinkId?: string;
  };
}

// Cloudflare Workers AI binding shape (minimal fields used).
export interface Ai {
  run: (model: string, options: { messages?: any[]; prompt?: string; [k: string]: any }) => Promise<any>;
}

// Minimal KV namespace shape for typed env bindings. The full
// Cloudflare Workers runtime type extends this; we only declare the
// bits used in code so the same shape compiles whether or not
// `@cloudflare/workers-types` is installed.
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
