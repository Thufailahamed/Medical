import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { DB } from "../lib/db";
import type { users } from "@healthcare/db";

export interface AppEnvironment {
  Bindings: {
    DB: any;
    R2: any;
    AI: Ai;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    ENVIRONMENT: string;
    DEV_MODE: string;
    JWT_SECRET?: string;
  };
  Variables: {
    supabase: SupabaseClient;
    user: User;
    userId: string;
    dbUser: typeof users.$inferSelect;
    userRole: string;
    db: DB;
  };
}

// Cloudflare Workers AI binding shape (minimal fields used).
export interface Ai {
  run: (model: string, options: { messages?: any[]; prompt?: string; [k: string]: any }) => Promise<any>;
}
