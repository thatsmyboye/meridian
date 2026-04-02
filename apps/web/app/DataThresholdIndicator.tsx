"use client";

import { useState } from "react";
import {
  calculateDataThreshold,
  getInsightsReadinessMessage,
  type ContentItem,
} from "@/lib/dataThreshold";

interface DataThresholdIndicatorProps {
  content: ContentItem[];
  canRunAnalysis?: boolean;
  onRunAnalysis?: () => Promise<void>;
}

type RunState = "idle" | "loading" | "success" | "error";

export default function DataThresholdIndicator({
  content,
  canRunAnalysis = false,
  onRunAnalysis,
}: DataThresholdIndicatorProps) {
  const thresholdInfo = calculateDataThreshold(content);
  const [runState, setRunState] = useState<RunState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (thresholdInfo.hasMinimumData) {
    return null;
  }

  const progressPercent = Math.min(
    100,
    Math.round(
      (thresholdInfo.daysSinceFirstContent / 30) * 100,
    ),
  );

  const message = getInsightsReadinessMessage(thresholdInfo);

  const handleRunAnalysis = async () => {
    if (!onRunAnalysis || runState === "loading") return;
    setRunState("loading");
    setErrorMessage(null);
    try {
      await onRunAnalysis();
      setRunState("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setRunState("error");
    }
  };

  return (
    <div style={{ marginBottom: 36 }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#fff",
          padding: "24px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginTop: 0,
              marginBottom: 6,
              color: "#111827",
            }}
          >
            🏗️ Building your baseline
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#6b7280",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            We&apos;re analyzing your content patterns. Once you have 30 days of data,
            we&apos;ll generate insights to help you optimize your strategy.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              background: "#f3f4f6",
              borderRadius: 8,
              height: 8,
              overflow: "hidden",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                background:
                  progressPercent < 50
                    ? "#3b82f6"
                    : progressPercent < 80
                      ? "#8b5cf6"
                      : "#ec4899",
                height: "100%",
                width: `${progressPercent}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <span>
              {thresholdInfo.daysSinceFirstContent} of 30 days
            </span>
            <span style={{ fontWeight: 600, color: "#111827" }}>
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Readiness message */}
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#059669",
            margin: 0,
            padding: "10px 12px",
            background: "#ecfdf5",
            borderRadius: 6,
            textAlign: "center",
          }}
        >
          {message}
        </p>

        {/* Additional info */}
        {thresholdInfo.averagePostsPerDay > 0 && (
          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              margin: "16px 0 0 0",
              textAlign: "center",
            }}
          >
            Based on your posting frequency (~{thresholdInfo.averagePostsPerDay.toFixed(1)} posts/day),
            we estimate insights in approximately{" "}
            <strong>{thresholdInfo.estimatedDaysUntilInsights}</strong> days
          </p>
        )}

        {/* On-demand analysis CTA — visible when synced across ≥2 platforms */}
        {canRunAnalysis && onRunAnalysis && runState !== "success" && (
          <div
            style={{
              marginTop: 20,
              borderTop: "1px solid #f3f4f6",
              paddingTop: 16,
            }}
          >
            <p
              style={{
                fontSize: 13,
                color: "#6b7280",
                margin: "0 0 10px 0",
                textAlign: "center",
              }}
            >
              You&apos;re synced across multiple platforms — get early insights now.
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleRunAnalysis}
                disabled={runState === "loading"}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  background: runState === "loading" ? "#93c5fd" : "#2563eb",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  cursor: runState === "loading" ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                }}
              >
                {runState === "loading" ? "Analyzing…" : "Run Analysis Now"}
              </button>
            </div>
            {runState === "error" && errorMessage && (
              <p
                style={{
                  fontSize: 12,
                  color: "#dc2626",
                  margin: "10px 0 0 0",
                  textAlign: "center",
                }}
              >
                {errorMessage}
              </p>
            )}
          </div>
        )}

        {/* Success state — replaces the CTA after the analysis is enqueued */}
        {canRunAnalysis && onRunAnalysis && runState === "success" && (
          <div
            style={{
              marginTop: 20,
              borderTop: "1px solid #f3f4f6",
              paddingTop: 16,
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#059669",
                margin: 0,
                padding: "10px 12px",
                background: "#ecfdf5",
                borderRadius: 6,
                textAlign: "center",
              }}
            >
              ✓ Analysis started! Refresh the page in a moment to see your insights.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
