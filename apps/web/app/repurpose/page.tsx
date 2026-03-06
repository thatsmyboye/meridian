import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Derivative {
  format: string;
  status: "pending" | "approved" | "rejected";
}

interface RepurposeJob {
  id: string;
  status: string;
  target_platform: string;
  selected_formats: string[];
  derivatives: Derivative[];
  created_at: string;
  source_item_id: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#fef3c7", color: "#92400e", label: "Pending" },
  processing: { bg: "#dbeafe", color: "#1e40af", label: "Processing" },
  review: { bg: "#e0e7ff", color: "#3730a3", label: "Ready for Review" },
  approved: { bg: "#d1fae5", color: "#065f46", label: "Approved" },
  completed: { bg: "#d1fae5", color: "#065f46", label: "Completed" },
  failed: { bg: "#fee2e2", color: "#991b1b", label: "Failed" },
};

const FORMAT_LABELS: Record<string, string> = {
  twitter_thread: "Twitter Thread",
  linkedin_post: "LinkedIn Post",
  instagram_caption: "Instagram Caption",
  newsletter_blurb: "Newsletter Blurb",
  tiktok_script: "TikTok Script",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatsList(formats: string[]): string {
  if (!formats || formats.length === 0) return "All formats";
  return formats
    .map((f) => FORMAT_LABELS[f] ?? f)
    .join(", ");
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function RepurposeQueuePage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!creator) redirect("/login");

  // Fetch all repurpose jobs ordered by most recent
  const { data: jobs } = await supabase
    .from("repurpose_jobs")
    .select(
      "id, status, target_platform, selected_formats, derivatives, created_at, source_item_id"
    )
    .eq("creator_id", creator.id)
    .order("created_at", { ascending: false });

  const allJobs = (jobs ?? []) as RepurposeJob[];

  // Fetch content item titles
  const sourceIds = [...new Set(allJobs.map((j) => j.source_item_id))];
  const contentMap: Record<string, { title: string; platform: string | null; content_type: string | null }> = {};

  if (sourceIds.length > 0) {
    const { data: items } = await supabase
      .from("content_items")
      .select("id, title, platform, content_type")
      .in("id", sourceIds);

    for (const item of items ?? []) {
      contentMap[item.id] = {
        title: item.title,
        platform: item.platform,
        content_type: item.content_type,
      };
    }
  }

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 32,
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
              color: "#111827",
            }}
          >
            Repurpose Queue
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>
            Track all in-progress and completed repurpose jobs.
          </p>
        </div>

        {/* New text import CTA */}
        <Link
          href="/repurpose/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 16px",
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
            flexShrink: 0,
            marginTop: 28,
          }}
        >
          + Paste text
        </Link>
      </div>

      {allJobs.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#9ca3af",
          }}
        >
          <p style={{ fontSize: 16, margin: "0 0 8px" }}>
            No repurpose jobs yet.
          </p>
          <p style={{ fontSize: 14, margin: "0 0 20px" }}>
            Start by pasting text or clicking &quot;Repurpose&quot; on any content item.
          </p>
          <Link
            href="/repurpose/new"
            style={{
              display: "inline-block",
              padding: "9px 18px",
              borderRadius: 8,
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            + Paste text to repurpose
          </Link>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px 160px 140px 32px",
              padding: "10px 20px",
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <span>Source</span>
            <span>Formats</span>
            <span>Status</span>
            <span>Created</span>
            <span />
          </div>

          {/* Table rows */}
          {allJobs.map((job, idx) => {
            const contentInfo = contentMap[job.source_item_id];
            const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE.pending;
            const derivatives = (job.derivatives ?? []) as Derivative[];
            const approvedCount = derivatives.filter(
              (d) => d.status === "approved"
            ).length;
            const isLast = idx === allJobs.length - 1;

            return (
              <Link
                key={job.id}
                href={`/repurpose/review?job_id=${job.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 220px 160px 140px 32px",
                  padding: "14px 20px",
                  borderBottom: isLast ? "none" : "1px solid #f3f4f6",
                  textDecoration: "none",
                  color: "inherit",
                  alignItems: "center",
                  gap: 0,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "transparent";
                }}
              >
                {/* Source title */}
                <div style={{ minWidth: 0, paddingRight: 16 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "#111827",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {contentInfo?.title ?? "Untitled content"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      marginTop: 2,
                    }}
                  >
                    {contentInfo?.content_type === "text_import"
                      ? "Text import"
                      : contentInfo?.platform
                        ? contentInfo.platform.charAt(0).toUpperCase() +
                          contentInfo.platform.slice(1)
                        : "Unknown"}
                  </div>
                </div>

                {/* Formats */}
                <div
                  style={{
                    fontSize: 13,
                    color: "#374151",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: 16,
                  }}
                  title={formatsList(job.selected_formats)}
                >
                  {formatsList(job.selected_formats)}
                  {derivatives.length > 0 && approvedCount > 0 && (
                    <span style={{ color: "#9ca3af", marginLeft: 4 }}>
                      ({approvedCount}/{derivatives.length} approved)
                    </span>
                  )}
                </div>

                {/* Status badge */}
                <div>
                  <span
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      borderRadius: 6,
                      padding: "3px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Created at */}
                <div
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDate(job.created_at)}
                </div>

                {/* Arrow */}
                <div
                  style={{
                    color: "#d1d5db",
                    fontSize: 18,
                    textAlign: "right",
                  }}
                >
                  ›
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
