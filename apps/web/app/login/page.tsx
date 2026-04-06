"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { isSafeRedirectPath } from "@/lib/auth";
import { provisionCreator } from "@meridian/api";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Sign-in failed — no authorisation code received. Please try again.",
  auth_error: "Sign-in failed — could not verify your session. Please try again.",
  server_error: "Sign-in failed — an unexpected error occurred. Please try again.",
  // Supabase error_code returned when it cannot complete the Google token exchange,
  // typically due to a misconfigured OAuth redirect URI or mismatched credentials.
  unexpected_failure: "Sign-in failed — Google could not complete the request. Please try again or contact support if the issue persists.",
  access_denied: "Sign-in was cancelled.",
};

function getErrorMessage(error: string | null, errorCode: string | null, description: string | null): string | null {
  if (!error) return null;
  if (error === "access_denied") return ERROR_MESSAGES.access_denied;
  // A more specific message is available for known error codes (e.g. unexpected_failure).
  if (errorCode && ERROR_MESSAGES[errorCode]) return ERROR_MESSAGES[errorCode];
  // Use the known friendly message if available, otherwise fall back to the
  // raw description (which may be technical but is better than nothing).
  return ERROR_MESSAGES[error] ?? description ?? "Sign-in failed. Please try again.";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createBrowserClient();

  type Mode = "signin" | "signup" | "forgot";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const oauthErrorMessage = getErrorMessage(
    searchParams.get("error"),
    searchParams.get("error_code"),
    searchParams.get("error_description"),
  );

  const errorMessage = localError ?? oauthErrorMessage;

  const nextRaw = searchParams.get("next") ?? "/";
  const next = isSafeRedirectPath(nextRaw) ? nextRaw : "/";

  // Supabase sometimes sends OAuth errors via the URL hash fragment as well as query
  // params (e.g. "#error=server_error&error_description=Unable to exchange external
  // code: 4/0Afr..."). The raw Google auth code in the hash sits in browser history
  // and could be captured by extensions or shared screenshots. Strip it immediately.
  useEffect(() => {
    if (window.location.hash.includes("error=")) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  async function handleGoogleSignIn() {
    setLocalError(null);
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (next !== "/") {
      callbackUrl.searchParams.set("next", next);
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setLocalError(
            error.message === "Invalid login credentials"
              ? "Invalid email or password."
              : error.message
          );
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try { await provisionCreator(supabase, user); } catch { /* non-fatal */ }
        }
        router.push(next);
      } else {
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        if (next !== "/") callbackUrl.searchParams.set("next", next);

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl.toString() },
        });
        if (error) {
          setLocalError(error.message);
          return;
        }
        // If session is null, Supabase sent a confirmation email.
        if (!data.session) {
          setSuccessMessage("Check your email and click the confirmation link, then sign in.");
          setMode("signin");
          return;
        }
        // Email confirmation is disabled — user is signed in immediately.
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try { await provisionCreator(supabase, user); } catch { /* non-fatal */ }
        }
        router.push(next);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        setLocalError(error.message);
        return;
      }
      setSuccessMessage("Check your email for a password reset link.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(135deg, #f8f9fb 0%, #eef2ff 50%, #f5f3ff 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          animation: "fadeSlideIn 0.4s ease-out",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <Image
            src="/Meridian.jpg"
            alt="Meridian logo"
            width={56}
            height={56}
            style={{
              borderRadius: 14,
              marginBottom: 16,
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
              objectFit: "cover",
            }}
          />
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#111827",
              margin: 0,
            }}
          >
            Welcome to Meridian
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "#6b7280",
              marginTop: 8,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Know what works. Ship it everywhere.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "36px 32px",
            boxShadow:
              "0 1px 3px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.04)",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 6px",
              textAlign: "center",
            }}
          >
            {mode === "signin"
              ? "Sign in to your account"
              : mode === "signup"
                ? "Create your account"
                : "Reset your password"}
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#9ca3af",
              margin: "0 0 28px",
              textAlign: "center",
            }}
          >
            {mode === "forgot"
              ? "Enter your email to receive a reset link."
              : "Use Google or your email to get started"}
          </p>

          {errorMessage && (
            <div
              role="alert"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 20,
                fontSize: 14,
                color: "#b91c1c",
                lineHeight: 1.5,
              }}
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 20,
                fontSize: 14,
                color: "#15803d",
                lineHeight: 1.5,
              }}
            >
              {successMessage}
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleSignIn}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "12px 20px",
              borderRadius: 10,
              border: "1.5px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.background = "#f9fafb";
              e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Google icon */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "20px 0",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            <span style={{ fontSize: 13, color: "#9ca3af", whiteSpace: "nowrap" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          </div>

          {/* Forgot password form */}
          {mode === "forgot" ? (
            <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  fontSize: 15,
                  color: "#111827",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
              />
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: isLoading ? "#93c5fd" : "linear-gradient(135deg, #2563eb, #7c3aed)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.opacity = "0.9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                {isLoading ? "Please wait…" : "Send reset link"}
              </button>
            </form>
          ) : (
            /* Email / password form */
            <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  fontSize: 15,
                  color: "#111827",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  fontSize: 15,
                  color: "#111827",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
              />
              {/* Forgot password link — only in signin mode */}
              {mode === "signin" && (
                <div style={{ textAlign: "right", marginTop: -4 }}>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setLocalError(null); setSuccessMessage(null); }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#6b7280",
                      fontSize: 13,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: isLoading ? "#93c5fd" : "linear-gradient(135deg, #2563eb, #7c3aed)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.opacity = "0.9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                {isLoading
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in with Email"
                    : "Create account"}
              </button>
            </form>
          )}

          {/* Mode toggle */}
          <p style={{ fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 16, marginBottom: 0 }}>
            {mode === "forgot" ? (
              <button
                onClick={() => { setMode("signin"); setLocalError(null); setSuccessMessage(null); }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#2563eb",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                ← Back to sign in
              </button>
            ) : mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => { setMode("signup"); setLocalError(null); setSuccessMessage(null); }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#2563eb",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("signin"); setLocalError(null); setSuccessMessage(null); }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#2563eb",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              textAlign: "center",
              marginTop: 20,
              lineHeight: 1.5,
            }}
          >
            By continuing, you agree to our{" "}
            <Link href="/terms" style={{ color: "#6b7280", textDecoration: "underline" }}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" style={{ color: "#6b7280", textDecoration: "underline" }}>
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Back to home */}
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              color: "#6b7280",
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 8,
              transition: "color 0.15s ease, background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#111827";
              e.currentTarget.style.background = "rgba(0,0,0,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#6b7280";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to home
          </Link>
        </div>

        {/* Features */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {[
            {
              title: "Unified Analytics",
              desc: "See performance across YouTube, Instagram, and newsletters in one view.",
            },
            {
              title: "AI Repurposing",
              desc: "Turn one piece of content into threads, posts, and scripts automatically.",
            },
            {
              title: "Pattern Insights",
              desc: "Discover what works best — posting times, formats, and length.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(255, 255, 255, 0.6)",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#2563eb",
                  flexShrink: 0,
                  marginTop: 7,
                }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#111827",
                  }}
                >
                  {feature.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginTop: 2,
                  }}
                >
                  {feature.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, #f8f9fb 0%, #eef2ff 50%, #f5f3ff 100%)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 28,
              fontWeight: 800,
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
            }}
          >
            M
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
