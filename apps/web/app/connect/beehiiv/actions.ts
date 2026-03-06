"use server";

/**
 * Server action for connecting a Beehiiv publication.
 *
 * Using a server action (vs. a plain API route) provides built-in CSRF
 * protection: Next.js validates the Origin header against the host and signs
 * the action ID, making cross-site form submissions impossible without the
 * valid action token.
 */

import { redirect } from "next/navigation";
import { encryptToken } from "@meridian/api";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";
import { getCreatorSubscription, checkPlatformLimit } from "@/lib/subscription";

const BEEHIIV_API_BASE = "https://api.beehiiv.com/v2";

interface BeehiivPublicationResponse {
  data: { id: string; name: string };
}

export async function connectBeehiiv(formData: FormData) {
  const apiKey = (formData.get("api_key") as string | null)?.trim();
  const publicationId = (formData.get("publication_id") as string | null)?.trim();

  if (!apiKey || !publicationId) {
    redirect("/connect/beehiiv?error=missing_params");
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connect/beehiiv?error=unauthenticated");
  }

  // ── Platform limit gate ───────────────────────────────────────────────────
  const subscription = await getCreatorSubscription();
  if (subscription) {
    const limitCheck = await checkPlatformLimit(
      subscription.creatorId,
      subscription.tier
    );
    if (!limitCheck.allowed) {
      // Only block if beehiiv is not already connected (allow re-connect/update)
      const { count } = await supabase
        .from("connected_platforms")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", subscription.creatorId)
        .eq("platform", "beehiiv");
      if ((count ?? 0) === 0) {
        redirect("/connect?error=platform_limit_reached");
      }
    }
  }

  // Validate credentials against the Beehiiv API.
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
    redirect("/connect/beehiiv?error=invalid_credentials");
  }

  const publication: BeehiivPublicationResponse = await validationRes.json();
  const publicationName = publication.data.name;

  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    console.error("[beehiiv/connect] Creator lookup failed:", creatorErr?.message);
    redirect("/connect/beehiiv?error=creator_not_found");
  }

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
    console.error("[beehiiv/connect] Upsert failed:", upsertErr?.message);
    redirect("/connect/beehiiv?error=save_failed");
  }

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

  redirect("/connect?success=beehiiv");
}
