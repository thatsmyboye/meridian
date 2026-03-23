/**
 * /connect/substack – Substack publication connection page
 *
 * Substack does not provide a first-party developer API. Content is imported
 * via the publication's public RSS feed, so no API key is required — the
 * creator only needs to supply their publication URL.
 *
 * The form submits via a server action (connectSubstack) which provides
 * built-in CSRF protection: Next.js validates Origin and signs the action ID.
 */

import { connectSubstack } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Please provide your Substack publication URL.",
  invalid_url:
    "Could not find a valid Substack publication at that URL. Make sure it's correct and publicly accessible.",
  creator_not_found:
    "Your creator profile was not found. Please sign out and back in.",
  save_failed:
    "Publication found but credentials could not be saved. Please try again.",
  unauthenticated: "You must be signed in to connect a platform.",
};

interface SubstackConnectPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SubstackConnectPage({
  searchParams,
}: SubstackConnectPageProps) {
  const { error } = await searchParams;

  const errorMessage = error
    ? (ERROR_MESSAGES[error] ??
      "An unexpected error occurred. Please try again.")
    : null;

  return (
    <main
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "32px 24px 64px",
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
        Connect Substack
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 32 }}>
        Enter your Substack publication URL to import your posts into Meridian.
        No API key required — content is synced from your public RSS feed.
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
        action={connectSubstack}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="publication_url"
            style={{ fontWeight: 600, fontSize: 14 }}
          >
            Publication URL
          </label>
          <input
            id="publication_url"
            name="publication_url"
            type="url"
            required
            placeholder="https://example.substack.com"
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
            Use your Substack URL (e.g.{" "}
            <span style={{ fontFamily: "monospace" }}>
              yourname.substack.com
            </span>
            ) or your custom domain if you have one configured.
          </p>
        </div>

        <div
          style={{
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "#0c4a6e",
          }}
        >
          <strong>Note:</strong> Only publicly available posts are imported via
          RSS. Paid subscriber-only content and analytics are not accessible
          without a Substack API (not currently offered by Substack).
        </div>

        <button
          type="submit"
          style={{
            background: "#FF6719",
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
          Connect publication
        </button>
      </form>
    </main>
  );
}
