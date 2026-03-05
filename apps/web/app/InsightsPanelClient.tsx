"use client";

import { useState } from "react";
import InsightsPanel from "./InsightsPanel";
import type { DashboardInsight } from "./InsightsPanel";
import type { ContentItem } from "@/lib/dataThreshold";

interface InsightsPanelClientProps {
  insights: DashboardInsight[];
  content?: ContentItem[];
}

export default function InsightsPanelClient({
  insights: initialInsights,
  content,
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

  return (
    <InsightsPanel
      insights={insights}
      content={content}
      onDismissInsight={handleDismissInsight}
    />
  );
}
