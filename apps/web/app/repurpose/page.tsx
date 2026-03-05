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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  let contentMap: Record<string, { title: string; platform: string }> = {};

  if (sourceIds.length > 0) {
    const { data: items } = await supabase
      .from("content_items")
      .select("id, title, platform")
      .in("id", sourceIds);

    for (const item of items ?? []) {
      contentMap[item.id] = { title: item.title, platform: item.platform };
    }
  }

  const reviewJobs = allJobs.filter((j) => j.status === "review");
  const otherJobs = allJobs.filter((j) => j.status !== "review");

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "64px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 32,
        }}
      >
        <div>
          <Link
            href="/"
            style={{
              color: "#6b7280",
              fontSize: 14,
              textDecoration: "none",
              display: "inline-block",
              marginBottom: 8,
            }}
          >
            ← Back to dashboard
          </Link>
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
            Review and approve AI-generated derivatives before publishing.
          </p>
        </div>
      </div>

      {/* Ready for Review section */}
      {reviewJobs.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Ready for Review
            <span
              style={{
                background: "#e0e7ff",
                color: "#3730a3",
                borderRadius: 12,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {reviewJobs.length}
            </span>
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {reviewJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                contentInfo={contentMap[job.source_item_id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* All Jobs section */}
      {otherJobs.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 16px",
            }}
          >
            All Jobs
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {otherJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                contentInfo={contentMap[job.source_item_id]}
              />
            ))}
          </div>
        </section>
      )}

      {allJobs.length === 0 && (
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
          <p style={{ fontSize: 14 }}>
            Start by clicking &quot;Repurpose&quot; on any content item from the dashboard.
          </p>
        </div>
      )}
    </main>
  );
}

// ─── JobCard ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  contentInfo,
}: {
  job: RepurposeJob;
  contentInfo?: { title: string; platform: string };
}) {
  const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE.pending;
  const derivatives = (job.derivatives ?? []) as Derivative[];
  const approvedCount = derivatives.filter((d) => d.status === "approved").length;
  const isReviewable = job.status === "review";

  return (
    <Link
      href={isReviewable ? `/repurpose/review?job_id=${job.id}` : "#"}
      style={{
        display: "block",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "16px 20px",
        background: "#fff",
        textDecoration: "none",
        color: "inherit",
        cursor: isReviewable ? "pointer" : "default",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: "#111827",
              marginBottom: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {contentInfo?.title ?? "Untitled content"}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            <span>{formatDate(job.created_at)}</span>
            {derivatives.length > 0 && (
              <span>
                {derivatives.length} format{derivatives.length !== 1 ? "s" : ""}
                {approvedCount > 0 && ` · ${approvedCount} approved`}
              </span>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: badge.bg,
              color: badge.color,
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {badge.label}
          </span>
          {isReviewable && (
            <span style={{ color: "#d1d5db", fontSize: 18 }}>›</span>
          )}
        </div>
      </div>
    </Link>
  );
}
