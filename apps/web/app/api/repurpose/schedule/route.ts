/**
 * /api/repurpose/schedule
 *
 * Manages scheduling, rescheduling, and cancellation of approved derivatives.
 *
 * POST   — Schedule an approved derivative to publish at a specific date/time.
 *          Writes scheduled_at + schedule_id to the derivative JSONB and fires
 *          the `repurpose/derivative.scheduled` Inngest event.
 *
 * DELETE — Cancel a scheduled derivative.
 *          Fires `repurpose/derivative.publish_cancelled` (Inngest cancelOn
 *          will stop the sleeping publish function).
 *          Resets the derivative status back to "approved".
 *
 * PUT    — Reschedule a scheduled derivative (cancel + schedule at new time).
 *          Fires cancel event for old schedule_id, then fires a new scheduled
 *          event with a fresh schedule_id and updated scheduled_at.
 */

import { type NextRequest, NextResponse } from "next/server";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

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

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthenticatedCreator(
  supabase: Awaited<ReturnType<typeof createServerClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  return creator;
}

// ─── POST /api/repurpose/schedule ─────────────────────────────────────────────

/**
 * Schedule an approved derivative for publishing.
 *
 * Body: { job_id, format_key, scheduled_at }
 *   scheduled_at — ISO 8601 datetime string (must be in the future)
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, format_key, scheduled_at } = body as {
    job_id?: string;
    format_key?: string;
    scheduled_at?: string;
  };

  if (!job_id || !format_key || !scheduled_at) {
    return NextResponse.json(
      { error: "Missing job_id, format_key, or scheduled_at" },
      { status: 400 }
    );
  }

  // Validate scheduled_at is a valid future datetime
  const scheduledDate = new Date(scheduled_at);
  if (isNaN(scheduledDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid scheduled_at datetime" },
      { status: 400 }
    );
  }
  if (scheduledDate <= new Date()) {
    return NextResponse.json(
      { error: "scheduled_at must be in the future" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const creator = await getAuthenticatedCreator(supabase);
  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load job
  const { data: job, error: jobErr } = await supabase
    .from("repurpose_jobs")
    .select("id, derivatives, scheduled_derivative_ids")
    .eq("id", job_id)
    .eq("creator_id", creator.id)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const derivatives = (job.derivatives ?? []) as Derivative[];
  const derivative = derivatives.find((d) => d.format === format_key);

  if (!derivative) {
    return NextResponse.json(
      { error: `Derivative '${format_key}' not found` },
      { status: 404 }
    );
  }

  if (derivative.status !== "approved") {
    return NextResponse.json(
      { error: `Derivative must be 'approved' to schedule; current status: '${derivative.status}'` },
      { status: 422 }
    );
  }

  const schedule_id = randomUUID();
  const now = new Date().toISOString();

  // Update derivative with schedule info
  const updatedDerivatives = derivatives.map((d) => {
    if (d.format !== format_key) return d;
    return {
      ...d,
      status: "scheduled",
      scheduled_at,
      schedule_id,
      updated_at: now,
    };
  });

  // Track schedule_id in scheduled_derivative_ids for admin/lookup
  const scheduledIds = {
    ...((job.scheduled_derivative_ids ?? {}) as Record<string, string>),
    [format_key]: schedule_id,
  };

  const { error: updateErr } = await supabase
    .from("repurpose_jobs")
    .update({
      derivatives: JSON.parse(JSON.stringify(updatedDerivatives)),
      scheduled_derivative_ids: scheduledIds,
    })
    .eq("id", job_id);

  if (updateErr) {
    console.error("[schedule] DB update failed:", updateErr.message);
    return NextResponse.json(
      { error: "Failed to update derivative" },
      { status: 500 }
    );
  }

  // Fire Inngest event — function sleeps until scheduled_at then publishes
  try {
    await inngest.send({
      name: "repurpose/derivative.scheduled",
      data: {
        creator_id: creator.id,
        repurpose_job_id: job_id,
        format_key,
        schedule_id,
        scheduled_at,
      },
    });
  } catch (err) {
    console.error("[schedule] inngest.send failed:", err);
    // Roll back the DB update if Inngest fails
    const rolledBack = derivatives.map((d) => {
      if (d.format !== format_key) return d;
      return { ...d, status: "approved", scheduled_at: null, schedule_id: null, updated_at: now };
    });
    await supabase
      .from("repurpose_jobs")
      .update({
        derivatives: JSON.parse(JSON.stringify(rolledBack)),
        scheduled_derivative_ids: job.scheduled_derivative_ids ?? {},
      })
      .eq("id", job_id);

    return NextResponse.json(
      { error: "Failed to schedule publishing job" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "scheduled",
    job_id,
    format_key,
    schedule_id,
    scheduled_at,
    derivatives: updatedDerivatives,
  });
}

// ─── DELETE /api/repurpose/schedule ──────────────────────────────────────────

/**
 * Cancel a scheduled derivative.
 *
 * Body: { job_id, format_key }
 *
 * Fires the cancel event (Inngest cancelOn stops the sleeping function).
 * Resets derivative status to "approved" so it can be rescheduled.
 */
export async function DELETE(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, format_key } = body as {
    job_id?: string;
    format_key?: string;
  };

  if (!job_id || !format_key) {
    return NextResponse.json(
      { error: "Missing job_id or format_key" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const creator = await getAuthenticatedCreator(supabase);
  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("repurpose_jobs")
    .select("id, derivatives, scheduled_derivative_ids")
    .eq("id", job_id)
    .eq("creator_id", creator.id)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const derivatives = (job.derivatives ?? []) as Derivative[];
  const derivative = derivatives.find((d) => d.format === format_key);

  if (!derivative) {
    return NextResponse.json(
      { error: `Derivative '${format_key}' not found` },
      { status: 404 }
    );
  }

  if (derivative.status !== "scheduled") {
    return NextResponse.json(
      { error: `Derivative is not scheduled; current status: '${derivative.status}'` },
      { status: 422 }
    );
  }

  const { schedule_id } = derivative;
  const now = new Date().toISOString();

  // Reset derivative to approved
  const updatedDerivatives = derivatives.map((d) => {
    if (d.format !== format_key) return d;
    return {
      ...d,
      status: "approved",
      scheduled_at: null,
      schedule_id: null,
      updated_at: now,
    };
  });

  // Remove from scheduled_derivative_ids
  const scheduledIds = { ...((job.scheduled_derivative_ids ?? {}) as Record<string, string>) };
  delete scheduledIds[format_key];

  const { error: updateErr } = await supabase
    .from("repurpose_jobs")
    .update({
      derivatives: JSON.parse(JSON.stringify(updatedDerivatives)),
      scheduled_derivative_ids: scheduledIds,
    })
    .eq("id", job_id);

  if (updateErr) {
    console.error("[schedule] Cancel DB update failed:", updateErr.message);
    return NextResponse.json(
      { error: "Failed to cancel schedule" },
      { status: 500 }
    );
  }

  // Fire cancel event to stop the Inngest sleep
  if (schedule_id) {
    try {
      await inngest.send({
        name: "repurpose/derivative.publish_cancelled",
        data: { schedule_id },
      });
    } catch (err) {
      // Log but don't fail — the DB is already updated; the Inngest function
      // will detect the status change and skip publishing.
      console.error("[schedule] Cancel inngest.send failed:", err);
    }
  }

  return NextResponse.json({
    status: "cancelled",
    job_id,
    format_key,
    derivatives: updatedDerivatives,
  });
}

// ─── PUT /api/repurpose/schedule ─────────────────────────────────────────────

/**
 * Reschedule a derivative (cancel old schedule, set new time).
 *
 * Body: { job_id, format_key, scheduled_at }
 *
 * Cancels the existing Inngest job and creates a new one at the new time.
 * The derivative status stays "scheduled" throughout.
 */
export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, format_key, scheduled_at } = body as {
    job_id?: string;
    format_key?: string;
    scheduled_at?: string;
  };

  if (!job_id || !format_key || !scheduled_at) {
    return NextResponse.json(
      { error: "Missing job_id, format_key, or scheduled_at" },
      { status: 400 }
    );
  }

  const scheduledDate = new Date(scheduled_at);
  if (isNaN(scheduledDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid scheduled_at datetime" },
      { status: 400 }
    );
  }
  if (scheduledDate <= new Date()) {
    return NextResponse.json(
      { error: "scheduled_at must be in the future" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const creator = await getAuthenticatedCreator(supabase);
  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("repurpose_jobs")
    .select("id, derivatives, scheduled_derivative_ids")
    .eq("id", job_id)
    .eq("creator_id", creator.id)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const derivatives = (job.derivatives ?? []) as Derivative[];
  const derivative = derivatives.find((d) => d.format === format_key);

  if (!derivative) {
    return NextResponse.json(
      { error: `Derivative '${format_key}' not found` },
      { status: 404 }
    );
  }

  if (derivative.status !== "scheduled") {
    return NextResponse.json(
      { error: `Derivative must be 'scheduled' to reschedule; current status: '${derivative.status}'` },
      { status: 422 }
    );
  }

  const oldScheduleId = derivative.schedule_id;
  const newScheduleId = randomUUID();
  const now = new Date().toISOString();

  // Update derivative with new schedule info
  const updatedDerivatives = derivatives.map((d) => {
    if (d.format !== format_key) return d;
    return {
      ...d,
      status: "scheduled",
      scheduled_at,
      schedule_id: newScheduleId,
      updated_at: now,
    };
  });

  const scheduledIds = {
    ...((job.scheduled_derivative_ids ?? {}) as Record<string, string>),
    [format_key]: newScheduleId,
  };

  const { error: updateErr } = await supabase
    .from("repurpose_jobs")
    .update({
      derivatives: JSON.parse(JSON.stringify(updatedDerivatives)),
      scheduled_derivative_ids: scheduledIds,
    })
    .eq("id", job_id);

  if (updateErr) {
    console.error("[schedule] Reschedule DB update failed:", updateErr.message);
    return NextResponse.json(
      { error: "Failed to reschedule derivative" },
      { status: 500 }
    );
  }

  // Cancel old Inngest job (if there was one)
  if (oldScheduleId) {
    try {
      await inngest.send({
        name: "repurpose/derivative.publish_cancelled",
        data: { schedule_id: oldScheduleId },
      });
    } catch (err) {
      console.error("[schedule] Cancel old schedule inngest.send failed:", err);
    }
  }

  // Fire new scheduled event
  try {
    await inngest.send({
      name: "repurpose/derivative.scheduled",
      data: {
        creator_id: creator.id,
        repurpose_job_id: job_id,
        format_key,
        schedule_id: newScheduleId,
        scheduled_at,
      },
    });
  } catch (err) {
    console.error("[schedule] Reschedule inngest.send failed:", err);
    return NextResponse.json(
      { error: "Failed to create new scheduled job" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "rescheduled",
    job_id,
    format_key,
    schedule_id: newScheduleId,
    scheduled_at,
    derivatives: updatedDerivatives,
  });
}
