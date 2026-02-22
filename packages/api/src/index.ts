/**
 * @meridian/api — Shared API layer
 *
 * Provides type-safe Supabase client factories and shared fetch utilities.
 */

export type { Creator, ConnectedPlatform, ContentItem } from "@meridian/types";

// ─── Supabase config ──────────────────────────────────────────────────────────

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Reads Supabase config from environment variables.
 * Supports both Next.js (NEXT_PUBLIC_*) and Expo (EXPO_PUBLIC_*) conventions
 * so the shared package works in web and mobile apps.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  return { url, anonKey };
}

// ─── Client factories ─────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { SupabaseClient };

/**
 * Creates a Supabase client for React Native / Expo contexts.
 * Sessions are stored in localStorage (via the default @supabase/supabase-js
 * storage adapter), which is fine for native apps but incompatible with SSR.
 *
 * **Do NOT use in Next.js / SSR apps.** In SSR apps sessions must be persisted
 * in cookies so that Server Components can access them. Use the cookie-aware
 * `createBrowserClient` from `@supabase/ssr` (or the wrapper in
 * `apps/web/lib/supabase/client.ts`) instead.
 *
 * Usage (React Native / Expo only):
 *   import { createNativeClient } from "@meridian/api";
 *   const supabase = createNativeClient();
 */
export function createNativeClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  return createClient(url, anonKey);
}
