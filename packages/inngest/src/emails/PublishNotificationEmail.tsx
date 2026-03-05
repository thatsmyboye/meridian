import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublishNotificationEmailProps {
  type: "published" | "failed_publish";
  creatorName: string;
  platformLabel: string;   // e.g. "Twitter / X Thread"
  contentTitle: string;    // source content title
  /** For 'published': link to the live post. */
  externalUrl?: string;
  /** For 'failed_publish': link back to the review page to retry. */
  retryUrl?: string;
  /** Human-readable publish time, e.g. "Mar 5, 2026 at 9:00 AM PST". */
  publishedAt: string;
}

// ─── Email component ──────────────────────────────────────────────────────────

export function PublishNotificationEmail({
  type,
  creatorName,
  platformLabel,
  contentTitle,
  externalUrl,
  retryUrl,
  publishedAt,
}: PublishNotificationEmailProps) {
  const isSuccess = type === "published";
  const firstName = creatorName.split(" ")[0] ?? creatorName;

  const previewText = isSuccess
    ? `Your ${platformLabel} post published successfully`
    : `Publishing failed — retry your ${platformLabel} post`;

  const accentColor = isSuccess ? "#16a34a" : "#dc2626";
  const accentBg = isSuccess ? "#f0fdf4" : "#fef2f2";
  const statusLabel = isSuccess ? "Published" : "Failed";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* ── Header ──────────────────────────────────────────────── */}
          <Section style={styles.header}>
            <Text style={styles.logo}>MERIDIAN</Text>
            <Heading style={styles.headline}>
              {isSuccess ? "Your post is live!" : "Publishing failed"}
            </Heading>
            <Text style={styles.subheadline}>
              {isSuccess
                ? `Hi ${firstName}, your scheduled content went out on time.`
                : `Hi ${firstName}, we couldn't publish your content after multiple attempts.`}
            </Text>
          </Section>

          {/* ── Status card ─────────────────────────────────────────── */}
          <Section style={{ ...styles.statusCard, backgroundColor: accentBg, borderLeftColor: accentColor }}>
            <Text style={{ ...styles.statusBadge, color: accentColor }}>
              {statusLabel}
            </Text>
            <Text style={styles.platformLabel}>{platformLabel}</Text>
            <Text style={styles.contentTitle}>{contentTitle}</Text>
            <Text style={styles.publishedAt}>{publishedAt}</Text>
          </Section>

          {/* ── CTA ─────────────────────────────────────────────────── */}
          {isSuccess && externalUrl && (
            <Section style={styles.ctaSection}>
              <Button href={externalUrl} style={{ ...styles.button, backgroundColor: accentColor }}>
                View live post →
              </Button>
            </Section>
          )}

          {!isSuccess && retryUrl && (
            <>
              <Section style={styles.failureBody}>
                <Text style={styles.failureText}>
                  This can happen when a platform token has expired or the
                  platform API is temporarily unavailable. You can edit and
                  reschedule the post from the review page.
                </Text>
              </Section>
              <Section style={styles.ctaSection}>
                <Button href={retryUrl} style={{ ...styles.button, backgroundColor: accentColor }}>
                  Retry publishing →
                </Button>
              </Section>
            </>
          )}

          {/* ── Footer ──────────────────────────────────────────────── */}
          <Hr style={styles.divider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You're receiving this because you scheduled content via Meridian.
            </Text>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} Meridian. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  body: {
    backgroundColor: "#f8fafc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    margin: 0,
    padding: "32px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    margin: "0 auto",
    maxWidth: "560px",
    overflow: "hidden" as const,
  },
  header: {
    backgroundColor: "#0f172a",
    padding: "40px 40px 32px",
  },
  logo: {
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "700" as const,
    letterSpacing: "4px",
    margin: "0 0 20px",
  },
  headline: {
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "700" as const,
    margin: "0 0 10px",
  },
  subheadline: {
    color: "#94a3b8",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: 0,
  },
  statusCard: {
    borderLeft: "4px solid",
    borderRadius: "0 6px 6px 0",
    margin: "28px 32px 0",
    padding: "16px 20px",
  },
  statusBadge: {
    fontSize: "11px",
    fontWeight: "700" as const,
    letterSpacing: "1.5px",
    margin: "0 0 8px",
    textTransform: "uppercase" as const,
  },
  platformLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "600" as const,
    margin: "0 0 4px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  contentTitle: {
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: "600" as const,
    lineHeight: "1.4",
    margin: "0 0 8px",
  },
  publishedAt: {
    color: "#94a3b8",
    fontSize: "13px",
    margin: 0,
  },
  ctaSection: {
    padding: "28px 32px 8px",
  },
  button: {
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block" as const,
    fontSize: "14px",
    fontWeight: "600" as const,
    padding: "12px 24px",
    textDecoration: "none",
  },
  failureBody: {
    padding: "20px 32px 0",
  },
  failureText: {
    color: "#475569",
    fontSize: "14px",
    lineHeight: "1.7",
    margin: 0,
  },
  divider: {
    borderColor: "#e2e8f0",
    borderTop: "1px solid #e2e8f0",
    margin: "32px 0 0",
  },
  footer: {
    padding: "20px 32px 28px",
  },
  footerText: {
    color: "#94a3b8",
    fontSize: "12px",
    lineHeight: "1.6",
    margin: "0 0 4px",
    textAlign: "center" as const,
  },
} as const;

export default PublishNotificationEmail;
