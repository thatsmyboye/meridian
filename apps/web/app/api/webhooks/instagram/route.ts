import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest } from "next/server";

/**
 * GET  /api/webhooks/instagram  — Meta webhook verification challenge
 * POST /api/webhooks/instagram  — Meta webhook event delivery
 *
 * Configure the Meta App Dashboard:
 *   Webhooks → Edit Subscription → Callback URL:
 *     https://meridian.banton-digital.com/api/webhooks/instagram
 *   Verify Token: value of META_WEBHOOK_VERIFY_TOKEN env var
 *
 * Required env vars:
 *   META_WEBHOOK_VERIFY_TOKEN  – must match the Verify Token set in Meta App Dashboard
 *   META_APP_SECRET            – used to verify HMAC-SHA256 payload signatures
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hubMode = searchParams.get("hub.mode");
  const hubVerifyToken = searchParams.get("hub.verify_token");
  const hubChallenge = searchParams.get("hub.challenge");

  if (hubMode !== "subscribe" || hubChallenge === null) {
    return new Response("Bad Request", { status: 400 });
  }

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error(
      "[webhooks/instagram] META_WEBHOOK_VERIFY_TOKEN is not set — set it in your environment variables"
    );
    return new Response("Internal Server Error", { status: 500 });
  }

  if (hubVerifyToken !== expectedToken) {
    console.error(
      "[webhooks/instagram] Verify token mismatch — ensure the token in Meta App Dashboard matches META_WEBHOOK_VERIFY_TOKEN"
    );
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(hubChallenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: NextRequest) {
  // Meta signs every payload with HMAC-SHA256 using the app secret.
  // Validate X-Hub-Signature-256 before processing any event data.
  const signature = request.headers.get("x-hub-signature-256");

  if (!signature) {
    return new Response("Forbidden", { status: 403 });
  }

  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    console.error(
      "[webhooks/instagram] META_APP_SECRET is not set — cannot verify webhook signature"
    );
    return new Response("Internal Server Error", { status: 500 });
  }

  const body = await request.text();
  const expectedSignature =
    "sha256=" + createHmac("sha256", appSecret).update(body).digest("hex");

  // Reject if lengths differ before the timing-safe compare to avoid exceptions.
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    console.error(
      "[webhooks/instagram] X-Hub-Signature-256 mismatch — request rejected"
    );
    return new Response("Forbidden", { status: 403 });
  }

  // Signature verified — process the event payload.
  // Meta sends an array of entry objects; each entry contains one or more
  // changes (e.g. media published, comment added, mention, etc.).
  // For now we acknowledge receipt; individual event handlers can be added here.
  return new Response("OK", { status: 200 });
}
