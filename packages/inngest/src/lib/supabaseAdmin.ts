import { createClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client authenticated with the service-role key.
 * This bypasses Row Level Security and should only be used in trusted
 * server-side contexts (Inngest functions).
 */
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
