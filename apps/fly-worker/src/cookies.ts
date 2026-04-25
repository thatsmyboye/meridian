import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const NETSCAPE_HEADER = "# Netscape HTTP Cookie File";
const COOKIES_PATH = path.join(os.tmpdir(), "yt_dlp_cookies.txt");

interface JsonCookie {
  domain: string;
  name: string;
  value: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
  session?: boolean;
}

/**
 * Converts a JSON cookie array (Chrome DevTools / browser-extension export)
 * into the 7-field tab-separated Netscape format that yt-dlp expects:
 *
 *   domain  subdomain_flag  path  secure  expiry  name  value
 */
function jsonCookiesToNetscape(cookies: JsonCookie[]): string {
  const lines = [NETSCAPE_HEADER];
  for (const c of cookies) {
    const domain = c.domain.startsWith(".") ? c.domain : `.${c.domain}`;
    const includeSubdomains = "TRUE";
    const cookiePath = c.path ?? "/";
    const secure = c.secure ? "TRUE" : "FALSE";
    const expiry = c.session ? "0" : String(Math.round(c.expirationDate ?? 0));
    lines.push(
      [domain, includeSubdomains, cookiePath, secure, expiry, c.name, c.value].join("\t")
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * Decodes YT_DLP_COOKIES_B64 from the environment and writes a valid
 * Netscape-format cookie file to a temp path, returning that path.
 *
 * Supports two source formats:
 *   - Netscape text (what yt-dlp and browser "cookies.txt" exports produce)
 *   - JSON array   (Chrome DevTools / "EditThisCookie" JSON export)
 *
 * In both cases a proper "# Netscape HTTP Cookie File" header is guaranteed.
 *
 * Returns null when the env var is absent.
 * Throws when the value is present but cannot be decoded or formatted.
 */
export function writeCookiesFile(): string | null {
  const cookiesB64 = process.env.YT_DLP_COOKIES_B64;
  if (!cookiesB64) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(cookiesB64.trim(), "base64").toString("utf-8").trim();
  } catch (err) {
    throw new Error(`YT_DLP_COOKIES_B64: base64 decode failed — ${err}`);
  }

  if (!decoded) {
    throw new Error("YT_DLP_COOKIES_B64: decoded to empty string");
  }

  let content: string;

  // Try JSON array format first (Chrome DevTools / browser extension export)
  if (decoded.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded);
    } catch (err) {
      throw new Error(`YT_DLP_COOKIES_B64: looks like JSON but failed to parse — ${err}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error("YT_DLP_COOKIES_B64: JSON value is not an array of cookies");
    }
    content = jsonCookiesToNetscape(parsed as JsonCookie[]);
  } else {
    // Assume Netscape text format; add the required header if it was stripped
    content = decoded.startsWith(NETSCAPE_HEADER)
      ? decoded + "\n"
      : `${NETSCAPE_HEADER}\n${decoded}\n`;
  }

  fs.writeFileSync(COOKIES_PATH, content, "utf-8");
  return COOKIES_PATH;
}
