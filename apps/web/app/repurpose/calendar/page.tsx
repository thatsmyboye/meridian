import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import CalendarClient, { type CalendarItem } from "./CalendarClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Derivative {
  format: string;
  content: string;
  platform: string;
  char_count: number;
  status: string;
  scheduled_at: string | null;
  schedule_id: string | null;
  published_at: string | null;
  publish_error: string | null;
  previous_drafts: string[];
  created_at: string;
  updated_at: string;
}

// ─── Label map ────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  twitter_thread: "Twitter / X Thread",
  linkedin_post: "LinkedIn Post",
  instagram_caption: "Instagram Caption",
  newsletter_blurb: "Newsletter Blurb",
  tiktok_script: "TikTok Script",
};

// ─── Page (server component) ─────────────────────────────────────────────────

export default async function ContentCalendarPage() {
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

  // Fetch all jobs with derivatives that have scheduled_at populated.
  // We look for jobs where scheduled_derivative_ids is not empty,
  // plus those where any derivative has status scheduled/published/failed_publish.
  const { data: jobs } = await supabase
    .from("repurpose_jobs")
    .select("id, source_item_id, derivatives")
    .eq("creator_id", creator.id)
    .order("created_at", { ascending: false });

  const allJobs = jobs ?? [];

  // Collect all source item IDs
  const sourceItemIds = [...new Set(allJobs.map((j) => j.source_item_id).filter(Boolean))];

  const contentTitles: Record<string, string> = {};
  if (sourceItemIds.length > 0) {
    const { data: items } = await supabase
      .from("content_items")
      .select("id, title")
      .in("id", sourceItemIds);

    for (const item of items ?? []) {
      contentTitles[item.id] = item.title ?? "Untitled";
    }
  }

  // Flatten all scheduled/published/failed_publish derivatives into calendar items
  const calendarItems: CalendarItem[] = [];

  for (const job of allJobs) {
    const derivatives = (job.derivatives ?? []) as Derivative[];
    const sourceTitle = contentTitles[job.source_item_id] ?? "Untitled";

    for (const d of derivatives) {
      if (
        d.status === "scheduled" ||
        d.status === "published" ||
        d.status === "failed_publish"
      ) {
        // Use scheduled_at for scheduled items; published_at as fallback for published
        const dateAt = d.scheduled_at ?? d.published_at;
        if (!dateAt) continue;

        calendarItems.push({
          jobId: job.id,
          formatKey: d.format,
          platform: d.platform,
          formatLabel: FORMAT_LABELS[d.format] ?? d.format,
          content: d.content,
          scheduledAt: dateAt,
          status: d.status as "scheduled" | "published" | "failed_publish",
          publishedAt: d.published_at,
          publishError: d.publish_error,
          sourceTitle,
        });
      }
    }
  }

  return <CalendarClient items={calendarItems} />;
}
