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
    JWT_SECRET?: string;
    CRON_SECRET?: string;
    // Phase 1.4: domain hosting email aliases for Phase 1.4 ingestion.
    // e.g. "records.healthhub.app" — used in the address handed to users.
    EMAIL_ALIAS_DOMAIN: string;
  };
  Variables: {
    user: User;
    userId: string;
    dbUser: typeof users.$inferSelect;
    userRole: string;
    db: DB;
    locale: Locale;
  };
}

// Cloudflare Workers AI binding shape (minimal fields used).
export interface Ai {
  run: (model: string, options: { messages?: any[]; prompt?: string; [k: string]: any }) => Promise<any>;
}
