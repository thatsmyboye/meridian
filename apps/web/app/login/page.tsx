"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { isSafeRedirectPath } from "@/lib/auth";

function LoginForm() {
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  async function handleGoogleSignIn() {
    const nextRaw = searchParams.get("next") ?? "/";
    const next = isSafeRedirectPath(nextRaw) ? nextRaw : "/";
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
              marginBottom: 16,
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
            }}
          >
            M
          </div>
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
            Sign in to your account
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#9ca3af",
              margin: "0 0 28px",
              textAlign: "center",
            }}
          >
            Use your Google account to get started
          </p>

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

          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              textAlign: "center",
              marginTop: 20,
              lineHeight: 1.5,
            }}
          >
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
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
