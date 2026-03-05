import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import DerivativeReviewClient from "./DerivativeReviewClient";

/**
 * /repurpose/review?job_id=UUID
 *
 * Server component that loads job data and passes it to the
 * interactive client component for the review queue UI.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ job_id?: string }>;
}) {
  const { job_id } = await searchParams;

  if (!job_id) redirect("/repurpose");

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

  // Fetch the job with all derivatives
  const { data: job } = await supabase
    .from("repurpose_jobs")
    .select(
      "id, status, derivatives, selected_formats, source_transcript, source_item_id, created_at"
    )
    .eq("id", job_id)
    .eq("creator_id", creator.id)
    .single();

  if (!job) redirect("/repurpose");

  // Fetch content item
  const { data: contentItem } = await supabase
    .from("content_items")
    .select("id, title, platform, body")
    .eq("id", job.source_item_id)
    .single();

  return (
    <DerivativeReviewClient
      jobId={job.id}
      jobStatus={job.status}
      derivatives={job.derivatives ?? []}
      sourceTranscript={job.source_transcript ?? ""}
      contentTitle={contentItem?.title ?? "Untitled"}
      contentPlatform={contentItem?.platform ?? "other"}
      contentBody={contentItem?.body ?? ""}
    />
  );
}
