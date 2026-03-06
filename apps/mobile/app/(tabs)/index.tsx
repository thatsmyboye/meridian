/**
 * Dashboard screen — analytics overview.
 *
 * Mirrors the key metrics from the web dashboard:
 *  - Summary cards: total views, avg engagement rate, posts published
 *  - Recent content list with per-item view/engagement stats
 *
 * Data is fetched directly from Supabase using the same queries as the web,
 * reusing @meridian/types for shared type safety. Pull-to-refresh re-fetches.
 */

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ContentRow {
  id: string;
  title: string;
  platform: string;
  publishedAt: string;
  views: number;
  engagementRate: number;
}

interface DashboardData {
  totalViews: number;
  avgEngagement: number;
  postsCount: number;
  recentContent: ContentRow[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    youtube: "YouTube",
    instagram: "Instagram",
    tiktok: "TikTok",
    beehiiv: "Beehiiv",
  };
  return map[platform] ?? platform;
}

function platformEmoji(platform: string): string {
  const map: Record<string, string> = {
    youtube: "▶️",
    instagram: "📷",
    tiktok: "🎵",
    beehiiv: "✉️",
  };
  return map[platform] ?? "📄";
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relativeDate(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86_400_000
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─── Data fetching ─────────────────────────────────────────────────────────

async function fetchDashboard(): Promise<DashboardData | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!creator) return null;

  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data: contentItems } = await supabase
    .from("content_items")
    .select("id, title, platform, published_at")
    .eq("creator_id", creator.id)
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(50);

  if (!contentItems || contentItems.length === 0) {
    return { totalViews: 0, avgEngagement: 0, postsCount: 0, recentContent: [] };
  }

  const { data: snapshots } = await supabase
    .from("performance_snapshots")
    .select("content_item_id, views, engagement_rate, snapshot_date")
    .in(
      "content_item_id",
      contentItems.map((c) => c.id)
    )
    .order("snapshot_date", { ascending: false });

  // Keep only the latest snapshot per content item
  const latest = new Map<string, { views: number; engagementRate: number }>();
  for (const snap of snapshots ?? []) {
    if (!latest.has(snap.content_item_id)) {
      latest.set(snap.content_item_id, {
        views: (snap.views as number) ?? 0,
        engagementRate: (snap.engagement_rate as number) ?? 0,
      });
    }
  }

  const recentContent: ContentRow[] = contentItems.map((item) => {
    const perf = latest.get(item.id);
    return {
      id: item.id,
      title: item.title as string,
      platform: item.platform as string,
      publishedAt: item.published_at as string,
      views: perf?.views ?? 0,
      engagementRate: perf?.engagementRate ?? 0,
    };
  });

  const totalViews = recentContent.reduce((s, c) => s + c.views, 0);
  const avgEngagement =
    recentContent.length > 0
      ? recentContent.reduce((s, c) => s + c.engagementRate, 0) /
        recentContent.length
      : 0;

  return {
    totalViews,
    avgEngagement,
    postsCount: recentContent.length,
    recentContent,
  };
}

// ─── Components ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricSub}>{sub}</Text>
    </View>
  );
}

function ContentCard({ item }: { item: ContentRow }) {
  return (
    <View style={styles.contentCard}>
      <View style={styles.contentCardHeader}>
        <Text style={styles.platformBadge}>
          {platformEmoji(item.platform)} {platformLabel(item.platform)}
        </Text>
        <Text style={styles.relativeDate}>{relativeDate(item.publishedAt)}</Text>
      </View>
      <Text style={styles.contentTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.contentStats}>
        <Text style={styles.statText}>👁 {formatViews(item.views)} views</Text>
        <Text style={styles.statText}>
          ⚡ {(item.engagementRate * 100).toFixed(1)}% eng.
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchDashboard();
      setData(result);
    } catch (err) {
      console.error("[dashboard] fetch failed:", err);
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Could not load dashboard.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data.recentContent}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#2563eb"
        />
      }
      ListHeaderComponent={
        <View>
          <StatusBar style="dark" />
          {/* Summary cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsRow}
          >
            <MetricCard
              label="Total Views"
              value={formatViews(data.totalViews)}
              sub="Last 30 days"
            />
            <MetricCard
              label="Avg Engagement"
              value={`${(data.avgEngagement * 100).toFixed(1)}%`}
              sub="Last 30 days"
            />
            <MetricCard
              label="Posts"
              value={String(data.postsCount)}
              sub="Last 30 days"
            />
          </ScrollView>

          <Text style={styles.sectionHeader}>Recent Content</Text>

          {data.recentContent.length === 0 && (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>
                No content in the last 30 days.{"\n"}Connect a platform to get
                started.
              </Text>
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => <ContentCard item={item} />}
    />
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  list: {
    paddingBottom: 32,
    backgroundColor: "#f9fafb",
  },
  metricsRow: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 12,
  },
  metricCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    minWidth: 130,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  metricSub: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  contentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  contentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  platformBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  relativeDate: {
    fontSize: 11,
    color: "#9ca3af",
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 20,
    marginBottom: 8,
  },
  contentStats: {
    flexDirection: "row",
    gap: 16,
  },
  statText: {
    fontSize: 12,
    color: "#6b7280",
  },
  emptySection: {
    paddingHorizontal: 16,
    paddingTop: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
  },
});
