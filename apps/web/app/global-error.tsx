"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root layout error boundary (Next.js App Router).
 * Catches errors thrown by the root layout itself (e.g. provider failures).
 * Must render its own <html> and <body> tags.
 */
export default function RootError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Meridian] Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#fff",
          color: "#111",
        }}
      >
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
          <p
            style={{
              color: "#6b7280",
              fontSize: 15,
              margin: "0 0 28px",
              lineHeight: 1.6,
            }}
          >
            A critical error occurred. Please refresh the page or try again
            later.
          </p>

          {error.digest && (
            <p
              style={{
                color: "#9ca3af",
                fontSize: 12,
                margin: "0 0 20px",
                fontFamily: "monospace",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
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
            <a
              href="/"
              style={{
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 22px",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
