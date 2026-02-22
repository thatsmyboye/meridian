/**
 * @meridian/api — Shared API layer
 *
 * Provides type-safe Supabase client factories and shared fetch utilities.
 * Full Supabase implementation is added in E01-02 and E01-03.
 *
 * Usage pattern (added in E01-02):
 *   import { createBrowserClient } from "@meridian/api";
 *   const supabase = createBrowserClient();
 */

export type { Creator, ConnectedPlatform, ContentItem } from "@meridian/types";

// ─── Supabase config ──────────────────────────────────────────────────────────

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Reads Supabase config from environment variables. */
export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}
