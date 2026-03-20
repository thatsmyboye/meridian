"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * App-level error boundary (Next.js App Router).
 * Catches unhandled errors from any page or layout below the root layout
 * and renders a branded fallback instead of Next.js's default error page.
 */
export default function GlobalError({ error, reset }: ErrorProps) {
    useEffect(() => {
    // Log to console in development; swap for an error-reporting service in prod
    console.error("[Meridian] Unhandled error:", error);
  }, [error]);

  function handleGoHome() {
    // Hard navigation clears the Next.js router cache and all error boundary
    // state — soft navigation (router.push/refresh) re-fetches the errored
    // route first, producing a second error digest and causing the page to
    // cycle between two error IDs.
    window.location.href = "/";
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "80px auto",
        padding: "0 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "#fef2f2",
          marginBottom: 20,
          fontSize: 28,
        }}
        aria-hidden="true"
      >
        ⚠
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>
        Something went wrong
      </h1>
      <p style={{ color: "#6b7280", fontSize: 15, margin: "0 0 28px", lineHeight: 1.6 }}>
        An unexpected error occurred. If the problem persists, please contact
        support.
      </p>

      {error.digest && (
        <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 20px", fontFamily: "monospace" }}>
          Error ID: {error.digest}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={reset}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 22px",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <button
          onClick={handleGoHome}
          style={{
            background: "#f3f4f6",
            color: "#374151",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "10px 22px",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Go home
        </button>
      </div>
    </main>
  );
}
