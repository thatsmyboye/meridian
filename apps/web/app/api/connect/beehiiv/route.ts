import { type NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@meridian/api";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/connect/beehiiv
 *
 * Validates a creator's Beehiiv API key + publication ID, then persists the
 * encrypted credentials in connected_platforms and kicks off an initial
 * content sync.
 *
 * Unlike OAuth-based platforms, Beehiiv uses long-lived API keys that do not
 * expire and require no refresh flow. The key is encrypted at rest using the
 * same AES-256-GCM scheme as OAuth tokens.
 *
 * Steps:
 *  1. Parse and validate form fields.
 *  2. Verify the creator is authenticated.
 *  3. Validate the API key + publication ID against Beehiiv's API.
 *  4. Encrypt the API key.
 *  5. Upsert a row in connected_platforms.
 *  6. Fire platform/connected to trigger an immediate content sync.
 *  7. Redirect to /connect?success=beehiiv.
 */

const BEEHIIV_API_BASE = "https://api.beehiiv.com/v2";

interface BeehiivPublicationResponse {
  data: {
    id: string;
    name: string;
  };
}

export async function POST(request: NextRequest) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  // ── 1. Parse form body ────────────────────────────────────────────────────
  const formData = await request.formData();
  const apiKey = (formData.get("api_key") as string | null)?.trim();
  const publicationId = (
    formData.get("publication_id") as string | null
  )?.trim();

  if (!apiKey || !publicationId) {
    return NextResponse.redirect(
      `${siteUrl}/connect/beehiiv?error=missing_params`,
      303
    );
  }

  // ── 2. Verify authenticated creator ──────────────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${siteUrl}/connect/beehiiv?error=unauthenticated`,
      303
    );
  }

  // ── 3. Validate credentials against Beehiiv API ──────────────────────────
  // Fetching the publication details proves both the API key and publication
  // ID are correct. If either is wrong, the API returns a 401 or 404.
  const validationRes = await fetch(
    `${BEEHIIV_API_BASE}/publications/${encodeURIComponent(publicationId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!validationRes.ok) {
    console.error(
      "[beehiiv/connect] Credential validation failed:",
      validationRes.status,
      await validationRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect/beehiiv?error=invalid_credentials`,
      303
    );
  }

  const publication: BeehiivPublicationResponse = await validationRes.json();
  const publicationName = publication.data.name;

  // ── 4. Look up the creator row ────────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    console.error(
      "[beehiiv/connect] Creator lookup failed:",
      creatorErr?.message
    );
    return NextResponse.redirect(
      `${siteUrl}/connect/beehiiv?error=creator_not_found`,
      303
    );
  }

  // ── 5. Encrypt the API key and upsert connected_platforms ─────────────────
  // Beehiiv API keys are long-lived and do not expire, so token_expires_at
  // and refresh_token_enc are left as null.
  const accessTokenEnc = encryptToken(apiKey);

  const { data: platformData, error: upsertErr } = await supabase
    .from("connected_platforms")
    .upsert(
      {
        creator_id: creator.id,
        platform: "beehiiv",
        platform_user_id: publicationId,
        platform_username: publicationName,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: null,
        token_expires_at: null,
        scopes: [],
        status: "active",
      },
      { onConflict: "creator_id,platform" }
    )
    .select("id")
    .single();

  if (upsertErr || !platformData) {
    console.error(
      "[beehiiv/connect] connected_platforms upsert failed:",
      upsertErr?.message
    );
    return NextResponse.redirect(
      `${siteUrl}/connect/beehiiv?error=save_failed`,
      303
    );
  }

  // ── 6. Fire platform/connected to kick off an initial content sync ─────────
  try {
    await inngest.send({
      name: "platform/connected",
      data: {
        creator_id: creator.id,
        platform: "beehiiv",
        connected_platform_id: platformData.id,
      },
    });
  } catch (err) {
    console.error("[beehiiv/connect] inngest.send failed:", err);
  }

  // ── 7. Redirect to success ────────────────────────────────────────────────
  return NextResponse.redirect(`${siteUrl}/connect?success=beehiiv`, 303);
}
