import {
  Body,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DigestInsight {
  insight_type: string;
  summary: string;
  narrative: string | null;
  confidence_label: string | null;
  confidence: number;
}

export interface DigestContentItem {
  content_item_id: string;
  views: number | null;
  engagement_rate: number | null;
  item: {
    title: string;
    platform: string;
    url: string | null;
    published_at: string;
  };
}

export interface WeeklyDigestEmailProps {
  creatorName: string;
  weekStart: Date;
  weekEnd: Date;
  insights: DigestInsight[];
  bestContent: DigestContentItem | null;
  worstContent: DigestContentItem | null;
  totalPieces: number;
  actionableTip: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtPct(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    youtube: "YouTube",
    instagram: "Instagram",
    beehiiv: "Beehiiv",
    tiktok: "TikTok",
  };
  return labels[platform] ?? capitalize(platform);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: DigestInsight }) {
  const text = insight.narrative ?? insight.summary;
  const label = insight.confidence_label ?? "Emerging";

  const labelColors: Record<string, string> = {
    Strong: "#166534",
    Moderate: "#92400e",
    Emerging: "#1e3a5f",
  };
  const labelBg: Record<string, string> = {
    Strong: "#dcfce7",
    Moderate: "#fef3c7",
    Emerging: "#dbeafe",
  };

  return (
    <Section style={styles.insightCard}>
      <Row>
        <Column>
          <Text
            style={{
              ...styles.confidenceBadge,
              color: labelColors[label] ?? "#1e3a5f",
              backgroundColor: labelBg[label] ?? "#dbeafe",
            }}
          >
            {label}
          </Text>
          <Text style={styles.insightText}>{text}</Text>
        </Column>
      </Row>
    </Section>
  );
}

function ContentCard({
  item,
  label,
  accent,
}: {
  item: DigestContentItem;
  label: string;
  accent: string;
}) {
  return (
    <Section style={{ ...styles.contentCard, borderLeftColor: accent }}>
      <Text style={{ ...styles.contentLabel, color: accent }}>{label}</Text>
      <Text style={styles.contentTitle}>{truncate(item.item.title, 80)}</Text>
      <Text style={styles.contentMeta}>
        {platformLabel(item.item.platform)} &nbsp;·&nbsp; Engagement:{" "}
        {fmtPct(item.engagement_rate)} &nbsp;·&nbsp;{" "}
        {item.views?.toLocaleString() ?? "—"} views
      </Text>
    </Section>
  );
}

// ─── Email component ──────────────────────────────────────────────────────────

export function WeeklyDigestEmail({
  creatorName,
  weekStart,
  weekEnd,
  insights,
  bestContent,
  worstContent,
  totalPieces,
  actionableTip,
}: WeeklyDigestEmailProps) {
  const previewText = `Your Meridian weekly digest — ${fmtDate(weekStart)} to ${fmtDate(weekEnd)}`;
  const firstName = creatorName.split(" ")[0] ?? creatorName;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* ── Header ────────────────────────────────────────────── */}
          <Section style={styles.header}>
            <Text style={styles.logo}>MERIDIAN</Text>
            <Heading style={styles.weekLabel}>
              {fmtDate(weekStart)} – {fmtDate(weekEnd)}
            </Heading>
            <Text style={styles.greeting}>Hi {firstName},</Text>
            <Text style={styles.intro}>
              Here's your weekly performance snapshot.
              {totalPieces > 0
                ? ` You published ${totalPieces} piece${totalPieces === 1 ? "" : "s"} this week.`
                : " It was a quiet week — no new content published."}
            </Text>
          </Section>

          <Hr style={styles.divider} />

          {/* ── Top Insights ──────────────────────────────────────── */}
          {insights.length > 0 && (
            <Section style={styles.section}>
              <Heading as="h2" style={styles.sectionTitle}>
                Top Patterns
              </Heading>
              {insights.map((insight) => (
                <InsightCard key={insight.insight_type} insight={insight} />
              ))}
            </Section>
          )}

          {/* ── Best Piece ────────────────────────────────────────── */}
          {bestContent && (
            <>
              <Hr style={styles.divider} />
              <Section style={styles.section}>
                <Heading as="h2" style={styles.sectionTitle}>
                  This Week's Content
                </Heading>
                <ContentCard
                  item={bestContent}
                  label="Best Performer"
                  accent="#16a34a"
                />
                {worstContent && (
                  <ContentCard
                    item={worstContent}
                    label="Needs Attention"
                    accent="#dc2626"
                  />
                )}
              </Section>
            </>
          )}

          {/* ── Actionable Tip ────────────────────────────────────── */}
          <Hr style={styles.divider} />
          <Section style={styles.tipSection}>
            <Text style={styles.tipEyebrow}>THIS WEEK'S TIP</Text>
            <Text style={styles.tipText}>{actionableTip}</Text>
          </Section>

          {/* ── Footer ────────────────────────────────────────────── */}
          <Hr style={styles.divider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You're receiving this because you're a Meridian creator.
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
    maxWidth: "600px",
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
    margin: "0 0 16px",
  },
  weekLabel: {
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: "700" as const,
    margin: "0 0 16px",
  },
  greeting: {
    color: "#e2e8f0",
    fontSize: "16px",
    margin: "0 0 8px",
  },
  intro: {
    color: "#94a3b8",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: 0,
  },
  section: {
    padding: "32px 40px",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: "700" as const,
    letterSpacing: "2px",
    margin: "0 0 20px",
    textTransform: "uppercase" as const,
  },
  insightCard: {
    backgroundColor: "#f8fafc",
    borderRadius: "6px",
    marginBottom: "12px",
    padding: "16px",
  },
  confidenceBadge: {
    borderRadius: "4px",
    display: "inline-block" as const,
    fontSize: "11px",
    fontWeight: "600" as const,
    letterSpacing: "0.5px",
    margin: "0 0 8px",
    padding: "2px 8px",
  },
  insightText: {
    color: "#334155",
    fontSize: "14px",
    lineHeight: "1.7",
    margin: 0,
  },
  contentCard: {
    borderLeft: "4px solid",
    borderRadius: "0 6px 6px 0",
    marginBottom: "12px",
    paddingLeft: "16px",
    paddingTop: "4px",
    paddingBottom: "4px",
  },
  contentLabel: {
    fontSize: "11px",
    fontWeight: "700" as const,
    letterSpacing: "1px",
    margin: "0 0 4px",
    textTransform: "uppercase" as const,
  },
  contentTitle: {
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: "600" as const,
    lineHeight: "1.4",
    margin: "0 0 6px",
  },
  contentMeta: {
    color: "#64748b",
    fontSize: "13px",
    margin: 0,
  },
  tipSection: {
    backgroundColor: "#fffbeb",
    borderRadius: "6px",
    margin: "0 40px 32px",
    padding: "20px 24px",
  },
  tipEyebrow: {
    color: "#92400e",
    fontSize: "11px",
    fontWeight: "700" as const,
    letterSpacing: "2px",
    margin: "0 0 8px",
  },
  tipText: {
    color: "#451a03",
    fontSize: "15px",
    lineHeight: "1.7",
    margin: 0,
  },
  divider: {
    borderColor: "#e2e8f0",
    borderTop: "1px solid #e2e8f0",
    margin: 0,
  },
  footer: {
    padding: "24px 40px",
  },
  footerText: {
    color: "#94a3b8",
    fontSize: "12px",
    lineHeight: "1.6",
    margin: "0 0 4px",
    textAlign: "center" as const,
  },
} as const;

export default WeeklyDigestEmail;
