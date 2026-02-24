import "react-native-get-random-values";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import nacl from "tweetnacl";

const ENCRYPTION_KEY_STORAGE_KEY = "supabase_auth_encryption_key";

/**
 * Hex encode/decode helpers for Uint8Array (avoids base64 dependency issues).
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Get or create the 32-byte encryption key. Stored in SecureStore (small, ~64 hex chars).
 */
async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
  if (existing) {
    return fromHex(existing);
  }
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE_KEY, toHex(key));
  return key;
}

/**
 * Encrypt plaintext with secretbox. Returns hex(nonce + ciphertext).
 */
function encrypt(plaintext: string, key: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const message = new TextEncoder().encode(plaintext);
  const ciphertext = nacl.secretbox(message, nonce, key);
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);
  return toHex(combined);
}

/**
 * Decrypt hex-encoded (nonce + ciphertext) back to plaintext.
 */
function decrypt(encryptedHex: string, key: Uint8Array): string {
  const combined = fromHex(encryptedHex);
  const nonce = combined.subarray(0, nacl.secretbox.nonceLength);
  const ciphertext = combined.subarray(nacl.secretbox.nonceLength);
  const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
  if (!decrypted) {
    throw new Error("Decryption failed");
  }
  return new TextDecoder().decode(decrypted);
}

/**
 * Hybrid storage adapter for Supabase auth.
 *
 * Supabase persists a JSON session that can include large tokens and user_metadata
 * (e.g. Google profile fields). expo-secure-store has a ~2048 byte per-value limit
 * on iOS and variable limits on Android, which can cause sessions to fail to save
 * or restore (unexpected logouts, login not "sticking").
 *
 * This adapter:
 * - Stores a small 32-byte encryption key in SecureStore (well under the limit)
 * - Encrypts session data with NaCl secretbox and stores it in AsyncStorage
 *   (no practical size limit)
 *
 * Sensitive material remains protected: the key is in the secure enclave/Keystore,
 * and the session blob is encrypted at rest in AsyncStorage.
 */
const HybridSecureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    try {
      const encryptionKey = await getOrCreateEncryptionKey();
      return decrypt(raw, encryptionKey);
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const encryptionKey = await getOrCreateEncryptionKey();
    const encrypted = encrypt(value, encryptionKey);
    await AsyncStorage.setItem(key, encrypted);
  },

  removeItem: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Singleton Supabase client for the Expo/React Native app.
 *
 * - Sessions are persisted via hybrid storage (encrypted in AsyncStorage, key in SecureStore).
 * - autoRefreshToken keeps the Supabase JWT alive in the background.
 *   The client emits TOKEN_REFRESHED via onAuthStateChange when it rotates.
 * - detectSessionInUrl must be false in native — URL-based session detection
 *   is handled manually via the deep-link flow in the login screen.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: HybridSecureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
