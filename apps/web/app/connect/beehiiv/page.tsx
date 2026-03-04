/**
 * /connect/beehiiv – Beehiiv API key connection page
 *
 * Unlike OAuth-based platforms, Beehiiv uses API key authentication.
 * Creators enter their API key and publication ID; we validate the
 * credentials against the Beehiiv API before saving them.
 *
 * The form submits via a server action (connectBeehiiv) which provides
 * built-in CSRF protection: Next.js validates Origin and signs the action ID.
 */

import { connectBeehiiv } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Please provide both an API key and a publication ID.",
  invalid_credentials:
    "Could not verify your Beehiiv credentials. Check that your API key and publication ID are correct.",
  creator_not_found:
    "Your creator profile was not found. Please sign out and back in.",
  save_failed:
    "Credentials validated but could not be saved. Please try again.",
  unauthenticated: "You must be signed in to connect a platform.",
};

interface BeehiivConnectPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function BeehiivConnectPage({
  searchParams,
}: BeehiivConnectPageProps) {
  const { error } = await searchParams;

  const errorMessage = error
    ? (ERROR_MESSAGES[error] ??
      "An unexpected error occurred. Please try again.")
    : null;

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "64px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <a
        href="/connect"
        style={{
          display: "inline-block",
          marginBottom: 24,
          fontSize: 14,
          color: "#6b7280",
          textDecoration: "none",
        }}
      >
        ← Back to platforms
      </a>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Connect Beehiiv
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 32 }}>
        Enter your Beehiiv API key and publication ID to import your newsletter
        posts and track open rates and clicks in Meridian.
      </p>

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
            fontSize: 14,
          }}
        >
          {errorMessage}
        </div>
      )}

      <form
        action={connectBeehiiv}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="api_key"
            style={{ fontWeight: 600, fontSize: 14 }}
          >
            API Key
          </label>
          <input
            id="api_key"
            name="api_key"
            type="password"
            required
            placeholder="bh_api_••••••••••••••••••••••••••••"
            autoComplete="off"
            style={{
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 14,
              fontFamily: "monospace",
              outline: "none",
            }}
          />
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            Find your API key in Beehiiv → Settings → API.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="publication_id"
            style={{ fontWeight: 600, fontSize: 14 }}
          >
            Publication ID
          </label>
          <input
            id="publication_id"
            name="publication_id"
            type="text"
            required
            placeholder="pub_••••••••••••••••••••••••••••••••"
            autoComplete="off"
            style={{
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 14,
              fontFamily: "monospace",
              outline: "none",
            }}
          />
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            Find your publication ID in Beehiiv → Settings → Publication details.
          </p>
        </div>

        <button
          type="submit"
          style={{
            background: "#f97316",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 6,
            border: "none",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Connect newsletter
        </button>
      </form>
    </main>
  );
}
