import { supabase } from "@/lib/supabase";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Login screen — Google OAuth via the in-app browser (PKCE flow) and
 * email/password sign-in or sign-up.
 *
 * Google flow:
 *  1. Call signInWithOAuth to get the Google consent URL (skipBrowserRedirect
 *     prevents the SDK from trying to open a URL in a non-existent window).
 *  2. Open the URL with expo-web-browser, which shows the native browser sheet.
 *  3. Google redirects to meridian://auth/callback or exp://.../--/auth/callback (Expo Go).
 *  4. Parse the code from the redirect URL and exchange it for a session.
 *  5. onAuthStateChange in _layout fires SIGNED_IN → provisions creator row →
 *     navigates to the main app.
 *
 * Email flow:
 *  1. Call signInWithPassword or signUp directly.
 *  2. On success, onAuthStateChange in _layout fires SIGNED_IN and handles
 *     creator provisioning and navigation.
 */
export default function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  async function handleEmailAuth() {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          Alert.alert(
            "Sign-in error",
            error.message === "Invalid login credentials"
              ? "Invalid email or password."
              : error.message
          );
        }
        // On success, onAuthStateChange fires SIGNED_IN in _layout.tsx.
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          Alert.alert("Sign-up error", error.message);
          return;
        }
        if (!data.session) {
          // Email confirmation required.
          Alert.alert(
            "Check your email",
            "We sent a confirmation link to " + email.trim() + ". Click it to activate your account, then sign in."
          );
          setMode("signin");
        }
        // If session is set, onAuthStateChange fires SIGNED_IN in _layout.tsx.
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Meridian</Text>
      <Text style={styles.subtitle}>Know what works. Ship it everywhere.</Text>

      {/* Google sign-in */}
      <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
        <Text style={styles.googleButtonText}>Sign in with Google</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Email / password fields */}
      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor="#9ca3af"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#9ca3af"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        textContentType={mode === "signup" ? "newPassword" : "password"}
      />

      <TouchableOpacity
        style={[styles.emailButton, isLoading && styles.emailButtonDisabled]}
        onPress={handleEmailAuth}
        disabled={isLoading}
      >
        <Text style={styles.emailButtonText}>
          {isLoading ? "Please wait…" : mode === "signin" ? "Sign in with Email" : "Create account"}
        </Text>
      </TouchableOpacity>

      {/* Mode toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
        </Text>
        <TouchableOpacity onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
          <Text style={styles.toggleLink}>
            {mode === "signin" ? "Sign up" : "Sign in"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    marginBottom: 40,
    textAlign: "center",
  },
  googleButton: {
    width: "100%",
    backgroundColor: "#4285F4",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: "center",
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  input: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#111827",
    marginBottom: 12,
  },
  emailButton: {
    width: "100%",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  emailButtonDisabled: {
    backgroundColor: "#93c5fd",
  },
  emailButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    marginTop: 20,
    alignItems: "center",
  },
  toggleLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  toggleLink: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "600",
  },
});
