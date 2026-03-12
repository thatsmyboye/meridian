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
  // TODO: verify signature and handle events (media published, mentions, etc.)
  void request;
  return new Response("OK", { status: 200 });
}
