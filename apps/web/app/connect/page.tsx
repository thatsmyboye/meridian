/**
 * /connect – Platform connection page
 *
 * Lets creators connect their social accounts to Meridian via OAuth or API key.
 * Supports YouTube, Instagram, and Beehiiv. Shows success/error feedback via
 * query params set by the connection routes.
 */

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "The OAuth response was incomplete. Please try again.",
  state_mismatch: "Security check failed. Please try again.",
  token_exchange_failed: "Could not complete authentication. Please try again.",
  channel_fetch_failed: "Connected to Google but could not retrieve your YouTube channel.",
  no_youtube_channel: "No YouTube channel is associated with that Google account.",
  no_instagram_business_account:
    "No Instagram Business or Creator account was found linked to your Facebook Page. " +
    "Make sure your Instagram account is set to Business or Creator and is connected to a Facebook Page.",
  instagram_account_fetch_failed:
    "Connected to Meta but could not retrieve your Instagram account details.",
  creator_not_found: "Your creator profile was not found. Please sign out and back in.",
  save_failed: "Connected successfully but could not save credentials. Please try again.",
  access_denied: "You cancelled the authorisation request.",
};

interface ConnectPageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const { success, error } = await searchParams;

  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "An unexpected error occurred. Please try again.")
    : null;

  return (
    <main style={{ maxWidth: 480, margin: "64px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Connect platforms
      </h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Link your accounts so Meridian can import your content and analytics.
      </p>

      {success === "youtube" && (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            color: "#166534",
          }}
        >
          YouTube connected successfully. Your content will be imported shortly.
        </div>
      )}

      {success === "instagram" && (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            color: "#166534",
          }}
        >
          Instagram connected successfully. Your posts will be imported shortly.
        </div>
      )}

      {success === "beehiiv" && (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            color: "#166534",
          }}
        >
          Beehiiv connected successfully. Your newsletter posts will be imported shortly.
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            color: "#991b1b",
          }}
        >
          {errorMessage}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* YouTube */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>YouTube</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              Import videos and channel analytics
            </div>
          </div>

          <a
            href="/api/connect/youtube"
            style={{
              display: "inline-block",
              background: "#dc2626",
              color: "#fff",
              padding: "8px 18px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            {success === "youtube" ? "Reconnect" : "Connect"}
          </a>
        </div>

        {/* Instagram */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Instagram</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              Import posts and performance insights
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              Requires a Business or Creator account linked to a Facebook Page
            </div>
          </div>

          <a
            href="/api/connect/instagram"
            style={{
              display: "inline-block",
              background: "#7c3aed",
              color: "#fff",
              padding: "8px 18px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            {success === "instagram" ? "Reconnect" : "Connect"}
          </a>
        </div>

        {/* Beehiiv */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Beehiiv</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              Import newsletter posts and track open rates &amp; clicks
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              Requires a Beehiiv API key and publication ID
            </div>
          </div>

          <a
            href="/connect/beehiiv"
            style={{
              display: "inline-block",
              background: "#f97316",
              color: "#fff",
              padding: "8px 18px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            {success === "beehiiv" ? "Reconnect" : "Connect"}
          </a>
        </div>
      </div>
    </main>
  );
}
