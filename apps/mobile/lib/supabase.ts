import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

/**
 * expo-secure-store adapter for @supabase/supabase-js.
 *
 * Supabase stores the session (access token, refresh token) under a few keys.
 * SecureStore keeps them in the device's secure enclave / Keystore, which is
 * more appropriate than AsyncStorage for auth credentials.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Singleton Supabase client for the Expo/React Native app.
 *
 * - Sessions are persisted in SecureStore (survives app restarts).
 * - autoRefreshToken keeps the Supabase JWT alive in the background.
 *   The client emits TOKEN_REFRESHED via onAuthStateChange when it rotates.
 * - detectSessionInUrl must be false in native — URL-based session detection
 *   is handled manually via the deep-link flow in the login screen.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
