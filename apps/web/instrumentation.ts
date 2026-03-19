/**
 * Next.js instrumentation — runs once when the server (or edge runtime) starts.
 *
 * We use this hook to validate required environment variables early so that
 * any misconfiguration is caught at boot time with a clear error, rather than
 * surfacing as a confusing "token_encryption_failed" error when a user first
 * attempts to connect a platform.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run server-side (not in the Edge runtime, which has no crypto module).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEncryptionKey } = await import("@meridian/api");
    try {
      validateEncryptionKey();
    } catch (err) {
      // Log clearly and rethrow so the server fails to start — a silent
      // misconfiguration is worse than a loud startup failure.
      console.error(
        "[startup] TOKEN_ENCRYPTION_KEY is missing or invalid.",
        "Generate one with:\n",
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
        "\nThen add it to your environment as TOKEN_ENCRYPTION_KEY.",
        "\nOriginal error:",
        err
      );
      throw err;
    }
  }
}
