"use client";

import { useState } from "react";
import InsightsPanel from "./InsightsPanel";
import type { DashboardInsight } from "./InsightsPanel";
import type { ContentItem } from "@/lib/dataThreshold";

interface InsightsPanelClientProps {
  insights: DashboardInsight[];
  content?: ContentItem[];
  canRunAnalysis?: boolean;
}

export default function InsightsPanelClient({
  insights: initialInsights,
  content,
  canRunAnalysis = false,
}: InsightsPanelClientProps) {
  const [insights, setInsights] = useState(initialInsights);

  const handleDismissInsight = async (insightId: string) => {
    try {
      const response = await fetch("/api/insights/dismiss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ insight_id: insightId }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to dismiss insight: ${response.status} ${response.statusText}`
        );
      }

      // Remove the insight from the UI
      setInsights((prev) => prev.filter((insight) => insight.id !== insightId));
    } catch (error) {
      console.error("Failed to dismiss insight:", error);
      throw error;
    }
  };

  const handleRunAnalysis = async (): Promise<void> => {
    const response = await fetch("/api/analytics/run", { method: "POST" });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        (body as { message?: string }).message ??
          `Request failed: ${response.status} ${response.statusText}`
      );
    }
  };

  return (
    <InsightsPanel
      insights={insights}
      content={content}
      onDismissInsight={handleDismissInsight}
      canRunAnalysis={canRunAnalysis}
      onRunAnalysis={handleRunAnalysis}
    />
  );
}
