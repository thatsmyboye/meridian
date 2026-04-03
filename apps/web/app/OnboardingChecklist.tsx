"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISSED_KEY = "meridian_onboarding_dismissed";

interface OnboardingChecklistProps {
  hasPlatform: boolean;
  hasContent: boolean;
  hasRepurposeJob: boolean;
}

export default function OnboardingChecklist({
  hasPlatform,
  hasContent,
  hasRepurposeJob,
}: OnboardingChecklistProps) {
  // Start as dismissed to avoid SSR flash; useEffect reveals it if not dismissed
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored !== "true") {
      setDismissed(false);
    }
  }, []);

  const allComplete = hasPlatform && hasContent && hasRepurposeJob;

  if (dismissed || allComplete) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  const steps = [
    {
      label: "Connect a platform",
      href: "/connect",
      complete: hasPlatform,
    },
    {
      label: "Import your content",
      href: "/connect",
      complete: hasContent,
    },
    {
      label: "Repurpose your first post",
      href: "/repurpose/new",
      complete: hasRepurposeJob,
    },
  ];

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "20px 24px",
        background: "#fff",
        marginBottom: 24,
        position: "relative",
      }}
    >
      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss onboarding checklist"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "none",
          border: "none",
          fontSize: 18,
          color: "#9ca3af",
          cursor: "pointer",
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "#111827" }}>
        Get started
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((step) => (
          <div
            key={step.label}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            {/* Circle / checkmark indicator */}
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: step.complete ? "none" : "2px solid #d1d5db",
                background: step.complete ? "#22c55e" : "transparent",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {step.complete && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            {/* Label */}
            {step.complete ? (
              <span style={{ fontSize: 14, color: "#6b7280", textDecoration: "line-through" }}>
                {step.label}
              </span>
            ) : (
              <Link
                href={step.href}
                style={{
                  fontSize: 14,
                  color: "#2563eb",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {step.label} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
