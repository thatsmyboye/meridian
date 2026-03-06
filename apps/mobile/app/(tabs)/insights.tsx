/**
 * Insights screen — swipeable weekly pattern insight cards.
 *
 * Each card shows:
 *  - Pattern type icon + type label
 *  - Headline (summary)
 *  - Claude-generated narrative (2–3 sentences)
 *  - Confidence badge (Strong / Moderate / Emerging)
 *
 * UX:
 *  - Horizontal paging scroll (one card fills the screen width)
 *  - Dismiss button marks the insight as dismissed in Supabase
 *  - Pull-to-refresh re-fetches insights from Supabase
 */

import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

// ─── Types ─────────────────────────────────────────────────────────────────

interface InsightCard {
  id: string;
  insight_type: string;
  summary: string;
  narrative: string | null;
  confidence_label: string | null;
  confidence: number;
  generated_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get("window").width;

function insightEmoji(type: string): string {
  const map: Record<string, string> = {
    day_of_week: "📅",
    content_type: "🎬",
    length_bucket: "⏱",
    posting_frequency: "📈",
  };
  return map[type] ?? "💡";
}

function insightTypeLabel(type: string): string {
  const map: Record<string, string> = {
    day_of_week: "Best Day to Post",
    content_type: "Top Content Type",
    length_bucket: "Optimal Length",
    posting_frequency: "Posting Frequency",
  };
  return map[type] ?? type;
}

function confidenceColor(label: string | null): string {
  if (label === "Strong") return "#16a34a";
  if (label === "Moderate") return "#d97706";
  return "#6b7280";
}

function confidenceBg(label: string | null): string {
  if (label === "Strong") return "#dcfce7";
  if (label === "Moderate") return "#fef3c7";
  return "#f3f4f6";
}

// ─── Data fetching ─────────────────────────────────────────────────────────

async function fetchInsights(): Promise<InsightCard[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!creator) return [];

  const { data } = await supabase
    .from("pattern_insights")
    .select(
      "id, insight_type, summary, narrative, confidence_label, confidence, generated_at"
    )
    .eq("creator_id", creator.id)
    .eq("is_dismissed", false)
    .order("generated_at", { ascending: false })
    .limit(8);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    insight_type: row.insight_type as string,
    summary: row.summary as string,
    narrative: row.narrative as string | null,
    confidence_label: row.confidence_label as string | null,
    confidence: row.confidence as number,
    generated_at: row.generated_at as string,
  }));
}

async function dismissInsight(insightId: string): Promise<void> {
  await supabase
    .from("pattern_insights")
    .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
    .eq("id", insightId);
}

// ─── Components ────────────────────────────────────────────────────────────

function InsightCardView({
  insight,
  onDismiss,
}: {
  insight: InsightCard;
  onDismiss: (id: string) => void;
}) {
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await dismissInsight(insight.id);
      onDismiss(insight.id);
    } catch {
      setDismissing(false);
    }
  }

  return (
    <View style={[styles.card, { width: SCREEN_WIDTH - 32 }]}>
      {/* Type header */}
      <View style={styles.cardTypeRow}>
        <Text style={styles.cardEmoji}>{insightEmoji(insight.insight_type)}</Text>
        <Text style={styles.cardTypeLabel}>
          {insightTypeLabel(insight.insight_type)}
        </Text>
        {insight.confidence_label && (
          <View
            style={[
              styles.confidenceBadge,
              { backgroundColor: confidenceBg(insight.confidence_label) },
            ]}
          >
            <Text
              style={[
                styles.confidenceText,
                { color: confidenceColor(insight.confidence_label) },
              ]}
            >
              {insight.confidence_label}
            </Text>
          </View>
        )}
      </View>

      {/* Headline */}
      <Text style={styles.cardSummary}>{insight.summary}</Text>

      {/* Narrative */}
      {insight.narrative ? (
        <Text style={styles.cardNarrative}>{insight.narrative}</Text>
      ) : null}

      {/* Confidence bar */}
      <View style={styles.confidenceBarContainer}>
        <View style={styles.confidenceBarBg}>
          <View
            style={[
              styles.confidenceBarFill,
              {
                width: `${Math.round(insight.confidence * 100)}%`,
                backgroundColor: confidenceColor(insight.confidence_label),
              },
            ]}
          />
        </View>
        <Text style={styles.confidencePct}>
          {Math.round(insight.confidence * 100)}% confidence
        </Text>
      </View>

      {/* Dismiss */}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        disabled={dismissing}
        activeOpacity={0.7}
      >
        <Text style={styles.dismissButtonText}>
          {dismissing ? "Dismissing…" : "Dismiss"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchInsights();
      setInsights(result);
    } catch (err) {
      console.error("[insights] fetch failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  function handleDismiss(id: string) {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    // Scroll back to start after dismissal
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (insights.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563eb"
          />
        }
      >
        <StatusBar style="dark" />
        <Text style={styles.emptyEmoji}>💡</Text>
        <Text style={styles.emptyTitle}>No insights yet</Text>
        <Text style={styles.emptyBody}>
          Insights are generated weekly once you have 30+ days of content data.
          Pull down to refresh.
        </Text>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Paging indicator */}
      <Text style={styles.pageHint}>
        {insights.length} insight{insights.length !== 1 ? "s" : ""} · Swipe to
        browse
      </Text>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        refreshControl={
          // RefreshControl on horizontal ScrollView only works on Android;
          // we provide a refresh button as fallback for iOS.
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563eb"
          />
        }
        contentContainerStyle={styles.horizontalList}
      >
        {insights.map((insight) => (
          <View key={insight.id} style={styles.cardWrapper}>
            <InsightCardView insight={insight} onDismiss={handleDismiss} />
          </View>
        ))}
      </ScrollView>

      {/* iOS pull-to-refresh workaround: manual refresh button */}
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Text style={styles.refreshButtonText}>
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  pageHint: {
    textAlign: "center",
    fontSize: 12,
    color: "#9ca3af",
    paddingTop: 12,
    paddingBottom: 4,
  },
  horizontalList: {
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 0,
  },
  cardWrapper: {
    width: SCREEN_WIDTH - 32,
    paddingRight: 0,
    paddingVertical: 16,
    marginRight: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  cardEmoji: {
    fontSize: 24,
  },
  cardTypeLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5563",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardSummary: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 24,
    marginBottom: 12,
  },
  cardNarrative: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 22,
    marginBottom: 20,
  },
  confidenceBarContainer: {
    marginBottom: 20,
    gap: 4,
  },
  confidenceBarBg: {
    height: 4,
    backgroundColor: "#f3f4f6",
    borderRadius: 2,
    overflow: "hidden",
  },
  confidenceBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  confidencePct: {
    fontSize: 11,
    color: "#9ca3af",
  },
  dismissButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  dismissButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  refreshButton: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 16,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
  },
});
