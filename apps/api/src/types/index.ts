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
  };
}

// Cloudflare Workers AI binding shape (minimal fields used).
export interface Ai {
  run: (model: string, options: { messages?: any[]; prompt?: string; [k: string]: any }) => Promise<any>;
}
