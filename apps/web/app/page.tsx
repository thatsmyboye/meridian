import { createServerClient } from "@/lib/supabase/server";

/**
 * / — Meridian dashboard home
 *
 * Server component. Checks whether any connected platform has
 * status = "reauth_required" and renders a sticky alert banner with a
 * "Reconnect" CTA so analytics never silently go dark due to expired tokens.
 */
export default async function Home() {
  const supabase = await createServerClient();

  // Resolve the authenticated user and their creator profile.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reauthPlatforms: string[] = [];

  if (user) {
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (creator) {
      const { data: platforms } = await supabase
        .from("connected_platforms")
        .select("platform")
        .eq("creator_id", creator.id)
        .eq("status", "reauth_required");

      reauthPlatforms = (platforms ?? []).map((p) => p.platform as string);
    }
  }

  const youtubeReauthRequired = reauthPlatforms.includes("youtube");

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "64px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {youtubeReauthRequired && (
        <div
          role="alert"
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            color: "#78350f",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span>
            <strong>Action required:</strong> Your YouTube connection has
            expired. Analytics have been paused until you reconnect.
          </span>
          <a
            href="/api/connect/youtube"
            style={{
              display: "inline-block",
              background: "#dc2626",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            Reconnect YouTube
          </a>
        </div>
      )}

      <h1>Meridian</h1>
      <p>Know what works. Ship it everywhere.</p>
    </main>
  );
}
