import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { DB } from "../lib/db";
import type { users } from "@healthcare/db";

export interface AppEnvironment {
  Bindings: {
    DB: any;
    R2: any;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    ENVIRONMENT: string;
    DEV_MODE: string;
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
