/**
 * Review screen — repurpose derivative review queue.
 *
 * Shows all repurpose jobs in "review" status. The creator can:
 *  - Browse jobs (FlatList)
 *  - Tap a job to open an inline review panel
 *  - Swipe between derivative format tabs (twitter_thread, linkedin_post, …)
 *  - Edit derivative text in place
 *  - Approve, Reject, or Regenerate each derivative
 *
 * All writes go directly to Supabase — same derivatives JSONB column as web.
 * Regenerate fires the `repurpose/derivative.regenerate` Inngest event via
 * the web API (EXPO_PUBLIC_API_URL/api/repurpose/derivatives).
 */

import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { DerivativeFormatKey, RepurposeJob, Derivative } from "@meridian/types";

// ─── Helpers ───────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<DerivativeFormatKey, string> = {
  twitter_thread: "Twitter / X",
  linkedin_post: "LinkedIn",
  instagram_caption: "Instagram",
  newsletter_blurb: "Newsletter",
  tiktok_script: "TikTok",
};

const FORMAT_EMOJI: Record<DerivativeFormatKey, string> = {
  twitter_thread: "𝕏",
  linkedin_post: "💼",
  instagram_caption: "📷",
  newsletter_blurb: "✉️",
  tiktok_script: "🎵",
};

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "#d97706",
    review: "#2563eb",
    approved: "#16a34a",
    rejected: "#dc2626",
    scheduled: "#7c3aed",
    published: "#16a34a",
  };
  return map[status] ?? "#6b7280";
}

function statusBg(status: string): string {
  const map: Record<string, string> = {
    pending: "#fef3c7",
    review: "#eff6ff",
    approved: "#dcfce7",
    rejected: "#fee2e2",
    scheduled: "#ede9fe",
    published: "#dcfce7",
  };
  return map[status] ?? "#f3f4f6";
}

function relativeDate(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86_400_000
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Data fetching ─────────────────────────────────────────────────────────

interface JobRow extends Omit<RepurposeJob, "target_platform" | "target_format"> {
  source_title: string | null;
}

async function fetchReviewJobs(): Promise<{ creatorId: string; jobs: JobRow[] } | null> {
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

  const { data: jobs } = await supabase
    .from("repurpose_jobs")
    .select(
      "id, creator_id, source_content_id, status, derivatives, selected_formats, source_transcript, created_at, updated_at"
    )
    .eq("creator_id", creator.id)
    .eq("status", "review")
    .order("created_at", { ascending: false })
    .limit(30);

  if (!jobs || jobs.length === 0) return { creatorId: creator.id as string, jobs: [] };

  // Fetch source content titles
  const contentIds = [...new Set(jobs.map((j) => j.source_content_id as string))];
  const { data: contentItems } = await supabase
    .from("content_items")
    .select("id, title")
    .in("id", contentIds);

  const titleMap = new Map(
    (contentItems ?? []).map((c) => [c.id as string, c.title as string])
  );

  return {
    creatorId: creator.id as string,
    jobs: jobs.map((job) => ({
      id: job.id as string,
      creator_id: job.creator_id as string,
      source_content_id: job.source_content_id as string,
      status: job.status as RepurposeJob["status"],
      derivatives: (job.derivatives ?? []) as Derivative[],
      selected_formats: (job.selected_formats ?? []) as DerivativeFormatKey[],
      source_transcript: job.source_transcript as string | null,
      target_platform: "youtube" as const, // not used in mobile review
      target_format: "",
      output: null,
      created_at: job.created_at as string,
      updated_at: job.updated_at as string,
      source_title: titleMap.get(job.source_content_id as string) ?? null,
    })),
  };
}

// ─── Supabase writes (same JSONB patch as web) ─────────────────────────────

async function updateDerivativeStatus(
  jobId: string,
  derivatives: Derivative[],
  formatKey: string,
  newStatus: "approved" | "rejected"
): Promise<Derivative[]> {
  const updated = derivatives.map((d) =>
    d.format === formatKey
      ? { ...d, status: newStatus, updated_at: new Date().toISOString() }
      : d
  );
  await supabase
    .from("repurpose_jobs")
    .update({ derivatives: JSON.parse(JSON.stringify(updated)) })
    .eq("id", jobId);
  return updated;
}

async function updateDerivativeContent(
  jobId: string,
  derivatives: Derivative[],
  formatKey: string,
  newContent: string
): Promise<Derivative[]> {
  const updated = derivatives.map((d) =>
    d.format === formatKey
      ? {
          ...d,
          content: newContent,
          char_count: newContent.length,
          updated_at: new Date().toISOString(),
        }
      : d
  );
  await supabase
    .from("repurpose_jobs")
    .update({ derivatives: JSON.parse(JSON.stringify(updated)) })
    .eq("id", jobId);
  return updated;
}

async function regenerateDerivative(
  creatorId: string,
  jobId: string,
  formatKey: string
): Promise<void> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("EXPO_PUBLIC_API_URL is not set");
  }
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${apiUrl}/api/repurpose/derivatives`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: JSON.stringify({
      job_id: jobId,
      format_key: formatKey,
      creator_id: creatorId,
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Regenerate failed: ${msg}`);
  }
}

// ─── Job list item ─────────────────────────────────────────────────────────

function JobListItem({
  job,
  selected,
  onSelect,
}: {
  job: JobRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const pendingCount = job.derivatives.filter(
    (d) => d.status === "pending" || d.status === "approved" === false
  ).length;

  return (
    <TouchableOpacity
      style={[styles.jobItem, selected && styles.jobItemSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.jobItemTop}>
        <Text style={styles.jobTitle} numberOfLines={1}>
          {job.source_title ?? "Untitled"}
        </Text>
        <Text style={styles.jobDate}>{relativeDate(job.created_at)}</Text>
      </View>
      <View style={styles.jobFormatRow}>
        {(job.selected_formats as DerivativeFormatKey[]).map((fmt) => {
          const d = job.derivatives.find((dd) => dd.format === fmt);
          return (
            <View
              key={fmt}
              style={[
                styles.fmtPill,
                d ? { backgroundColor: statusBg(d.status) } : undefined,
              ]}
            >
              <Text style={[styles.fmtPillText, d ? { color: statusColor(d.status) } : undefined]}>
                {FORMAT_EMOJI[fmt]} {FORMAT_LABELS[fmt]}
              </Text>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

// ─── Derivative review panel ───────────────────────────────────────────────

function DerivativeReview({
  job,
  creatorId,
  onUpdate,
}: {
  job: JobRow;
  creatorId: string;
  onUpdate: (updated: Derivative[]) => void;
}) {
  const formats = job.selected_formats as DerivativeFormatKey[];
  const [activeFormat, setActiveFormat] = useState<DerivativeFormatKey>(
    formats[0] ?? "twitter_thread"
  );
  const [editContent, setEditContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const derivative = job.derivatives.find((d) => d.format === activeFormat);

  function getContent(): string {
    if (editContent[activeFormat] !== undefined) return editContent[activeFormat];
    return derivative?.content ?? "";
  }

  async function handleSaveEdit() {
    const content = editContent[activeFormat];
    if (!content) return;
    setSaving(true);
    try {
      const updated = await updateDerivativeContent(
        job.id,
        job.derivatives,
        activeFormat,
        content
      );
      onUpdate(updated);
    } catch {
      Alert.alert("Error", "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setSaving(true);
    // Save any pending edit first
    const currentContent = editContent[activeFormat];
    let derivatives = job.derivatives;
    if (currentContent !== undefined && currentContent !== derivative?.content) {
      derivatives = await updateDerivativeContent(
        job.id,
        job.derivatives,
        activeFormat,
        currentContent
      );
    }
    try {
      const updated = await updateDerivativeStatus(
        job.id,
        derivatives,
        activeFormat,
        "approved"
      );
      onUpdate(updated);
      setEditContent((prev) => {
        const next = { ...prev };
        delete next[activeFormat];
        return next;
      });
    } catch {
      Alert.alert("Error", "Failed to approve.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    setSaving(true);
    try {
      const updated = await updateDerivativeStatus(
        job.id,
        job.derivatives,
        activeFormat,
        "rejected"
      );
      onUpdate(updated);
    } catch {
      Alert.alert("Error", "Failed to reject.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    Alert.alert(
      "Regenerate?",
      `This will regenerate the ${FORMAT_LABELS[activeFormat]} derivative with AI.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          onPress: async () => {
            setSaving(true);
            try {
              await regenerateDerivative(creatorId, job.id, activeFormat);
              Alert.alert("Queued", "Regeneration has been queued. Refresh the queue in a moment.");
            } catch (err: unknown) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to regenerate.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  if (!derivative) {
    return (
      <View style={styles.noDeriv}>
        <Text style={styles.noDerivText}>Select a format above.</Text>
      </View>
    );
  }

  const isDirty =
    editContent[activeFormat] !== undefined &&
    editContent[activeFormat] !== derivative.content;

  return (
    <View style={styles.reviewPanel}>
      {/* Format tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.formatTabs}
      >
        {formats.map((fmt) => {
          const d = job.derivatives.find((dd) => dd.format === fmt);
          const active = fmt === activeFormat;
          return (
            <TouchableOpacity
              key={fmt}
              style={[styles.formatTab, active && styles.formatTabActive]}
              onPress={() => setActiveFormat(fmt)}
            >
              <Text
                style={[styles.formatTabText, active && styles.formatTabTextActive]}
              >
                {FORMAT_EMOJI[fmt]} {FORMAT_LABELS[fmt]}
              </Text>
              {d && (
                <View
                  style={[
                    styles.formatTabStatus,
                    { backgroundColor: statusBg(d.status) },
                  ]}
                >
                  <Text style={[{ color: statusColor(d.status), fontSize: 10, fontWeight: "700" }]}>
                    {d.status}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content editor */}
      <TextInput
        style={styles.editor}
        multiline
        value={getContent()}
        onChangeText={(text) =>
          setEditContent((prev) => ({ ...prev, [activeFormat]: text }))
        }
        placeholder="No content generated yet…"
        placeholderTextColor="#9ca3af"
        editable={!saving}
      />

      {/* Char count */}
      <Text style={styles.charCount}>{getContent().length} characters</Text>

      {/* Action row */}
      <View style={styles.actionRow}>
        {isDirty && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.saveBtn]}
            onPress={handleSaveEdit}
            disabled={saving}
          >
            <Text style={[styles.actionBtnText, styles.saveBtnText]}>
              {saving ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={handleReject}
          disabled={saving}
        >
          <Text style={[styles.actionBtnText, styles.rejectBtnText]}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.regenBtn]}
          onPress={handleRegenerate}
          disabled={saving}
        >
          <Text style={[styles.actionBtnText, styles.regenBtnText]}>↺ Regen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={handleApprove}
          disabled={saving}
        >
          <Text style={[styles.actionBtnText, styles.approveBtnText]}>✓ Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const [data, setData] = useState<{ creatorId: string; jobs: JobRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchReviewJobs();
      setData(result);
    } catch (err) {
      console.error("[review] fetch failed:", err);
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

  function handleDerivativeUpdate(jobId: string, updated: Derivative[]) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        jobs: prev.jobs.map((j) =>
          j.id === jobId ? { ...j, derivatives: updated } : j
        ),
      };
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const jobs = data?.jobs ?? [];
  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {jobs.length === 0 ? (
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
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyTitle}>Queue is clear</Text>
          <Text style={styles.emptyBody}>
            No derivatives are waiting for review. New repurpose jobs will appear
            here when ready.
          </Text>
        </ScrollView>
      ) : (
        <>
          {/* Job list */}
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            style={styles.jobList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#2563eb"
              />
            }
            renderItem={({ item }) => (
              <JobListItem
                job={item}
                selected={item.id === selectedJobId}
                onSelect={() =>
                  setSelectedJobId(item.id === selectedJobId ? null : item.id)
                }
              />
            )}
          />

          {/* Inline review panel for selected job */}
          {selectedJob && data && (
            <DerivativeReview
              job={selectedJob}
              creatorId={data.creatorId}
              onUpdate={(updated) =>
                handleDerivativeUpdate(selectedJob.id, updated)
              }
            />
          )}
        </>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  jobList: {
    flex: 1,
    maxHeight: 280,
  },
  jobItem: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  jobItemSelected: {
    borderWidth: 2,
    borderColor: "#2563eb",
  },
  jobItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  jobTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginRight: 8,
  },
  jobDate: {
    fontSize: 11,
    color: "#9ca3af",
  },
  jobFormatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  fmtPill: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fmtPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  // Review panel
  reviewPanel: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flex: 1,
    paddingBottom: 8,
  },
  formatTabs: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  formatTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  formatTabActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  formatTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  formatTabTextActive: {
    color: "#2563eb",
  },
  formatTabStatus: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  editor: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 14,
    color: "#111827",
    lineHeight: 20,
    textAlignVertical: "top",
    padding: 0,
  },
  charCount: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "right",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
    justifyContent: "flex-end",
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  saveBtn: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  saveBtnText: {
    color: "#374151",
  },
  rejectBtn: {
    backgroundColor: "#fee2e2",
  },
  rejectBtnText: {
    color: "#dc2626",
  },
  regenBtn: {
    backgroundColor: "#ede9fe",
  },
  regenBtnText: {
    color: "#7c3aed",
  },
  approveBtn: {
    backgroundColor: "#2563eb",
  },
  approveBtnText: {
    color: "#ffffff",
  },
  noDeriv: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noDerivText: {
    color: "#9ca3af",
    fontSize: 14,
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
