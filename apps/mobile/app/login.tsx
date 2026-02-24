import { supabase } from "@/lib/supabase";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * Login screen — Google OAuth via the in-app browser (PKCE flow).
 *
 * Flow:
 *  1. Call signInWithOAuth to get the Google consent URL (skipBrowserRedirect
 *     prevents the SDK from trying to open a URL in a non-existent window).
 *  2. Open the URL with expo-web-browser, which shows the native browser sheet.
 *  3. Google redirects to meridian://auth/callback or exp://.../--/auth/callback (Expo Go).
 *  4. Parse the code from the redirect URL and exchange it for a session.
 *  5. onAuthStateChange in _layout fires SIGNED_IN → provisions creator row →
 *     navigates to the main app.
 */
export default function LoginScreen() {
  async function handleGoogleSignIn() {
    // Build the deep-link redirect URL the device will intercept.
    const redirectUrl = Linking.createURL("auth/callback");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      Alert.alert("Sign-in error", error?.message ?? "Could not start Google sign-in.");
      return;
    }

    // Open the consent page in a native browser sheet.
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type !== "success") {
      // User cancelled or the browser was dismissed — no action needed.
      return;
    }

    // Extract the PKCE auth code from the redirect URL.
    const { queryParams } = Linking.parse(result.url);
    const code = queryParams?.code;

    if (typeof code !== "string") {
      Alert.alert("Sign-in error", "No authorisation code was returned.");
      return;
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      Alert.alert("Sign-in error", exchangeError.message);
    }
    // On success, onAuthStateChange fires SIGNED_IN in _layout.tsx which
    // handles creator provisioning and navigation.
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meridian</Text>
      <Text style={styles.subtitle}>Know what works. Ship it everywhere.</Text>
      <TouchableOpacity style={styles.button} onPress={handleGoogleSignIn}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 48,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#4285F4",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
