/**
 * @meridian/api — Shared API layer
 *
 * Provides type-safe Supabase client factories and shared fetch utilities.
 */

export type { Creator, ConnectedPlatform, ContentItem } from "@meridian/types";

// ─── Token encryption ─────────────────────────────────────────────────────────

export { encryptToken, decryptToken, validateEncryptionKey } from "./crypto";

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
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type { SupabaseClient };

// ─── Creator provisioning ─────────────────────────────────────────────────────

/**
 * Inserts a creators row on the user's very first sign-in.
 * Subsequent sign-ins skip the insert (row already exists).
 *
 * Uses Google OAuth metadata for display_name and avatar_url with a consistent
 * fallback chain. Safe to call on every sign-in; idempotent.
 *
 * Uses upsert with ON CONFLICT DO NOTHING to avoid race conditions when two
 * concurrent sign-ins (e.g., mobile and web) both attempt to provision.
 *
 * When user.email is null (e.g., phone auth, magic link without email), uses a
 * synthetic placeholder so provisioning still succeeds. Callers can prompt users
 * to add an email later via profile completion.
 *
 * @param supabase - Supabase client (browser, server, or native)
 * @param user - Authenticated user from Supabase Auth
 */
export async function provisionCreator(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email" | "user_metadata">
): Promise<void> {
  const meta = user.user_metadata ?? {};
  const email =
    user.email ?? `auth-${user.id}@meridian.placeholder`;
  const { error } = await supabase
    .from("creators")
    .upsert(
      {
        auth_user_id: user.id,
        display_name:
          (meta.full_name as string | undefined) ??
          (meta.name as string | undefined) ??
          user.email?.split("@")[0] ??
          "Creator",
        email,
        avatar_url:
          (meta.avatar_url as string | undefined) ??
          (meta.picture as string | undefined) ??
          null,
      },
      { onConflict: "auth_user_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[provisionCreator] creators upsert failed:", error.message);
  }
}

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
