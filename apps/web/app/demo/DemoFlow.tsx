"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  DEMO_CONTENT,
  DEMO_INSIGHTS,
  DEMO_DERIVATIVES,
  DEMO_SNAPSHOTS,
  DEMO_CREATOR,
  YOUTUBE_SCOPES,
  type DemoContentItem,
  type DemoInsight,
  type DemoDerivative,
} from "./demoData";

// ─── Types / constants ────────────────────────────────────────────────────────

type Step =
  | "login"
  | "connect"
  | "oauth-consent"
  | "dashboard"
  | "content-detail"
  | "repurpose-new"
  | "repurpose-review"
  | "publish-calendar";

const STEPS: { id: Step; label: string; group: string }[] = [
  { id: "login", label: "Sign in", group: "Auth" },
  { id: "connect", label: "Connect platforms", group: "Auth" },
  { id: "oauth-consent", label: "YouTube OAuth consent", group: "Auth" },
  { id: "dashboard", label: "Dashboard", group: "Analytics" },
  { id: "content-detail", label: "Content deep dive", group: "Analytics" },
  { id: "repurpose-new", label: "New repurpose job", group: "Repurpose" },
  { id: "repurpose-review", label: "Review derivatives", group: "Repurpose" },
  { id: "publish-calendar", label: "Schedule & publish", group: "Repurpose" },
];

const PLATFORM_BADGE: Record<string, { bg: string; color: string }> = {
  youtube: { bg: "#fee2e2", color: "#dc2626" },
  instagram: { bg: "#ede9fe", color: "#7c3aed" },
  beehiiv: { bg: "#ffedd5", color: "#f97316" },
  tiktok: { bg: "#f3f4f6", color: "#111827" },
  twitter: { bg: "#e0f2fe", color: "#0284c7" },
  linkedin: { bg: "#dbeafe", color: "#1d4ed8" },
  newsletter: { bg: "#f0fdf4", color: "#16a34a" },
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#dc2626",
  instagram: "#7c3aed",
  twitter: "#1d9bf0",
  linkedin: "#0a66c2",
  newsletter: "#16a34a",
  tiktok: "#111827",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function DemoFlow() {
  const [step, setStep] = useState<Step>("login");
  const [selectedContent, setSelectedContent] = useState<DemoContentItem>(DEMO_CONTENT[0]);
  const [derivatives, setDerivatives] = useState<DemoDerivative[]>(DEMO_DERIVATIVES);

  const currentIndex = STEPS.findIndex((s) => s.id === step);
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < STEPS.length - 1;

  function go(s: Step) {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next() {
    if (canGoForward) go(STEPS[currentIndex + 1].id);
  }

  function back() {
    if (canGoBack) go(STEPS[currentIndex - 1].id);
  }

  // ── Render ──
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: "#f9fafb", minHeight: "100vh" }}>
      {/* ── Demo banner ── */}
      <div
        style={{
          background: "linear-gradient(90deg, #1d4ed8 0%, #4f46e5 100%)",
          color: "#fff",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          fontSize: 13,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              background: "#fff",
              color: "#1d4ed8",
              fontWeight: 800,
              fontSize: 10,
              letterSpacing: "0.1em",
              padding: "2px 7px",
              borderRadius: 4,
              textTransform: "uppercase",
            }}
          >
            DEMO
          </span>
          <span style={{ fontWeight: 600 }}>Meridian — Google OAuth Verification Demo</span>
          <span style={{ opacity: 0.75 }}>
            · All data is sample/fictional — no real user data is shown
          </span>
        </div>
        <Link
          href="/"
          style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: 12 }}
        >
          ← Back to live app
        </Link>
      </div>

      {/* ── Step navigator ── */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 20px",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              style={{
                padding: "14px 16px",
                border: "none",
                borderBottom: `3px solid ${step === s.id ? "#2563eb" : "transparent"}`,
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: step === s.id ? 700 : 500,
                color: step === s.id ? "#2563eb" : "#6b7280",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: step === s.id ? "#2563eb" : "#f3f4f6",
                  color: step === s.id ? "#fff" : "#9ca3af",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Step content ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 80px" }}>
        {step === "login" && <StepLogin onNext={next} />}
        {step === "connect" && <StepConnect onNext={next} onBack={back} />}
        {step === "oauth-consent" && <StepOAuthConsent onNext={next} onBack={back} />}
        {step === "dashboard" && (
          <StepDashboard
            onSelectContent={(c) => { setSelectedContent(c); next(); }}
          />
        )}
        {step === "content-detail" && (
          <StepContentDetail content={selectedContent} onBack={back} />
        )}
        {step === "repurpose-new" && <StepRepurposeNew onNext={next} />}
        {step === "repurpose-review" && (
          <StepRepurposeReview
            derivatives={derivatives}
            onApprove={(format) =>
              setDerivatives((prev) =>
                prev.map((d) => (d.format === format ? { ...d, status: "approved" } : d)),
              )
            }
            onNext={next}
          />
        )}
        {step === "publish-calendar" && <StepPublishCalendar derivatives={derivatives} />}
      </div>

      {/* ── Bottom nav ── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#fff",
          borderTop: "1px solid #e5e7eb",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          zIndex: 100,
        }}
      >
        <button
          onClick={back}
          disabled={!canGoBack}
          style={{
            padding: "8px 18px",
            borderRadius: 7,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: canGoBack ? "#374151" : "#d1d5db",
            fontWeight: 600,
            fontSize: 13,
            cursor: canGoBack ? "pointer" : "not-allowed",
          }}
        >
          ← Back
        </button>

        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          Step {currentIndex + 1} of {STEPS.length} — {STEPS[currentIndex].label}
        </span>

        <button
          onClick={next}
          disabled={!canGoForward}
          style={{
            padding: "8px 18px",
            borderRadius: 7,
            border: "none",
            background: canGoForward ? "#2563eb" : "#e5e7eb",
            color: canGoForward ? "#fff" : "#9ca3af",
            fontWeight: 600,
            fontSize: 13,
            cursor: canGoForward ? "pointer" : "not-allowed",
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── Step 1: Login ────────────────────────────────────────────────────────────

function StepLogin({ onNext }: { onNext: () => void }) {
  const [clicked, setClicked] = useState(false);

  return (
    <DemoCard
      title="Step 1 — Sign in with Google"
      description="Users authenticate via Google OAuth 2.0. Meridian requests only basic profile information (name, email, profile picture) used to create the creator account."
    >
      <div
        style={{
          maxWidth: 400,
          margin: "0 auto",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 40,
          background: "#fff",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Meridian</div>
        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>
          Know what works. Ship it everywhere.
        </div>

        {!clicked ? (
          <button
            onClick={() => { setClicked(true); setTimeout(onNext, 900); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "12px 20px",
              borderRadius: 8,
              border: "1px solid #dadce0",
              background: "#fff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              color: "#3c4043",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            {/* Google "G" logo */}
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        ) : (
          <div style={{ color: "#16a34a", fontWeight: 600, fontSize: 14, padding: "12px 0" }}>
            ✓ Signed in as {DEMO_CREATOR.email} — redirecting…
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 12, color: "#9ca3af" }}>
          By signing in you agree to our{" "}
          <a href="/terms" style={{ color: "#9ca3af" }}>Terms of Service</a> and{" "}
          <a href="/privacy" style={{ color: "#9ca3af" }}>Privacy Policy</a>.
        </div>
      </div>

      <ScopeBox title="Google scopes used for sign-in">
        <ScopeRow icon="👤" scope="openid" detail="Verify your identity" />
        <ScopeRow icon="✉️" scope="email" detail="Read your email address" />
        <ScopeRow icon="🖼️" scope="profile" detail="Read your name and profile picture" />
      </ScopeBox>
    </DemoCard>
  );
}

// ─── Step 2: Connect platforms ────────────────────────────────────────────────

function StepConnect({ onNext }: NavProps) {
  return (
    <DemoCard
      title="Step 2 — Connect platforms"
      description="After sign-in, users land on the Connect Platforms page. They can link YouTube, Instagram, TikTok, Twitter/X, LinkedIn, and Beehiiv to import content and analytics."
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "24px 24px 0" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>Connect platforms</h2>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 20px" }}>
            Link your accounts so Meridian can import your content and analytics.
          </p>
          {/* Tier banner */}
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#0c4a6e" }}>
            Creator plan: 2 of 3 platforms connected.
          </div>
        </div>

        <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { id: "youtube", label: "YouTube", description: "Import videos and channel analytics", color: "#dc2626", connected: false, highlight: true },
            { id: "instagram", label: "Instagram", description: "Import posts and performance insights", color: "#7c3aed", connected: true, highlight: false },
            { id: "twitter", label: "X (Twitter)", description: "Import tweets and engagement metrics", color: "#111827", connected: true, highlight: false },
            { id: "tiktok", label: "TikTok", description: "Import videos and performance analytics", color: "#010101", connected: false, highlight: false },
            { id: "linkedin", label: "LinkedIn", description: "Import posts and professional engagement data", color: "#0a66c2", connected: false, highlight: false },
            { id: "beehiiv", label: "Beehiiv", description: "Import newsletter posts and track open rates", color: "#f97316", connected: false, highlight: false },
          ].map((p) => (
            <div
              key={p.id}
              style={{
                border: `1px solid ${p.highlight ? "#bfdbfe" : "#e5e7eb"}`,
                background: p.highlight ? "#eff6ff" : "#fff",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  {p.id === "youtube" && (
                    <svg height="14" viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M27.976 3.14A3.514 3.514 0 0 0 25.5.648C23.28 0 14 0 14 0S4.72 0 2.5.648A3.514 3.514 0 0 0 .024 3.14C-.648 5.373 0 10 0 10s-.648 4.627.024 6.86A3.514 3.514 0 0 0 2.5 19.352C4.72 20 14 20 14 20s9.28 0 11.5-.648a3.514 3.514 0 0 0 2.476-2.492C28.648 14.627 28 10 28 10s.648-4.627-.024-6.86z" fill="#FF0000"/>
                      <path d="M11.2 14.286 18.4 10l-7.2-4.286v8.572z" fill="#fff"/>
                    </svg>
                  )}
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</span>
                  {p.connected && (
                    <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                      Connected
                    </span>
                  )}
                  {p.highlight && (
                    <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                      Connecting now ↓
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{p.description}</div>
              </div>
              <button
                onClick={p.highlight ? onNext : undefined}
                style={{
                  background: p.connected ? "#f3f4f6" : p.color,
                  color: p.connected ? "#6b7280" : "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 14px",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: p.highlight ? "pointer" : "default",
                  whiteSpace: "nowrap",
                }}
              >
                {p.connected ? "Reconnect" : "Connect"}
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: "0 24px 20px", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
          YouTube features are powered by the YouTube API Services.{" "}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#9ca3af" }}>
            YouTube Terms of Service
          </a>
          .
        </div>
      </div>
    </DemoCard>
  );
}

// ─── Step 3: YouTube OAuth consent ───────────────────────────────────────────

function StepOAuthConsent({ onNext, onBack }: NavProps) {
  const [consented, setConsented] = useState(false);

  return (
    <DemoCard
      title="Step 3 — YouTube OAuth consent screen"
      description="Clicking 'Connect' redirects to Google's OAuth consent screen. Below is a mock-up of exactly what the user sees. After consent, Google redirects back to Meridian with an authorization code."
    >
      <div
        style={{
          maxWidth: 440,
          margin: "0 auto",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#fff",
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* Google header */}
        <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <svg width="22" height="22" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            <span style={{ fontSize: 16, color: "#3c4043" }}>Sign in with Google</span>
          </div>
          <p style={{ fontSize: 14, color: "#3c4043", margin: "0 0 4px" }}>
            <strong>Meridian</strong> wants to access your Google Account
          </p>
          <p style={{ fontSize: 13, color: "#5f6368", margin: 0 }}>{DEMO_CREATOR.email}</p>
        </div>

        {/* Scopes */}
        <div style={{ padding: "16px 28px" }}>
          <p style={{ fontSize: 13, color: "#3c4043", marginBottom: 12, fontWeight: 600 }}>
            This will allow Meridian to:
          </p>
          {YOUTUBE_SCOPES.map((s) => (
            <div key={s.scope} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="#1a73e8">
                  <path d="M5 8.5L2.5 6l.7-.7L5 7.1l3.8-3.8.7.7z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#3c4043" }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "#5f6368", marginTop: 2 }}>{s.detail}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, fontFamily: "monospace" }}>
                  {s.scope}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Privacy note */}
        <div style={{ padding: "12px 28px", background: "#f8f9fa", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", fontSize: 12, color: "#5f6368" }}>
          Make sure you trust Meridian. By granting access, you allow Meridian to use your information in accordance with their{" "}
          <a href="/privacy" style={{ color: "#1a73e8" }}>Privacy Policy</a> and{" "}
          <a href="/terms" style={{ color: "#1a73e8" }}>Terms of Service</a>.
          You can revoke access at any time at{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: "#1a73e8" }}>
            myaccount.google.com/permissions
          </a>.
        </div>

        {/* Buttons */}
        <div style={{ padding: "16px 28px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onBack}
            style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #dadce0", background: "#fff", color: "#3c4043", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          {!consented ? (
            <button
              onClick={() => { setConsented(true); setTimeout(onNext, 700); }}
              style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "#1a73e8", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Allow
            </button>
          ) : (
            <button
              disabled
              style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "#dcfce7", color: "#15803d", fontWeight: 600, fontSize: 13 }}
            >
              ✓ Allowed — syncing…
            </button>
          )}
        </div>
      </div>

      <ScopeBox title="What Meridian does with YouTube data">
        <ScopeRow icon="📹" scope="Videos & metadata" detail="Title, description, tags, thumbnails, duration, publish date — displayed in the dashboard and used to generate repurposed content." />
        <ScopeRow icon="📊" scope="Analytics (views, watch time, engagement)" detail="View counts, impressions, CTR, watch time, and engagement rates — displayed in the performance dashboard and used to compute pattern insights." />
        <ScopeRow icon="🔒" scope="Data storage" detail="OAuth tokens are encrypted (AES-256-GCM) at rest and are never shared with third parties. Analytics data is stored in the creator's private account." />
        <ScopeRow icon="❌" scope="What we never do" detail="We never post on your behalf, never modify your YouTube data, and we only request read-only scopes." />
      </ScopeBox>
    </DemoCard>
  );
}

// ─── Step 4: Dashboard ────────────────────────────────────────────────────────

function StepDashboard({
  onSelectContent,
}: { onSelectContent: (c: DemoContentItem) => void }) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

  const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

  const filtered = useMemo(() => {
    const cutoff = Date.now() - PERIOD_DAYS[period] * 86_400_000;
    return DEMO_CONTENT.filter((c) => new Date(c.publishedAt).getTime() >= cutoff);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const totalViews = filtered.reduce((s, c) => s + c.totalViews, 0);
  const avgEng =
    filtered.filter((c) => c.engagementRate > 0).reduce((s, c) => s + c.engagementRate, 0) /
      (filtered.filter((c) => c.engagementRate > 0).length || 1);
  const best = filtered.length ? filtered.reduce((a, b) => (a.totalViews >= b.totalViews ? a : b)) : null;

  const chartData = [...filtered]
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 8)
    .map((c) => ({ name: truncate(c.title, 22), views: c.totalViews, fill: PLATFORM_COLORS[c.platform] ?? "#6b7280" }));

  const visibleInsights = DEMO_INSIGHTS.filter((i) => !dismissedInsights.has(i.id));

  return (
    <DemoCard
      title="Step 4 — Dashboard"
      description="After YouTube sync completes (usually within minutes), the dashboard shows imported videos with view counts, engagement rates, and watch-time data — plus AI-generated pattern insights."
    >
      {/* Insights */}
      {visibleInsights.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#111827" }}>Pattern Insights</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {visibleInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                expanded={expandedInsight === insight.id}
                onToggle={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                onDismiss={() => setDismissedInsights((s) => new Set([...s, insight.id]))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Period filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {(["7d", "30d", "90d"] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid", borderColor: period === p ? "#2563eb" : "#e5e7eb", background: period === p ? "#2563eb" : "#fff", color: period === p ? "#fff" : "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        <MetricCard label="Total views" value={formatNumber(totalViews)} />
        <MetricCard label="Avg engagement rate" value={`${avgEng.toFixed(2)}%`} />
        <MetricCard
          label="Best performing"
          value={best ? truncate(best.title, 28) : "—"}
          sub={best ? `${formatNumber(best.totalViews)} views · ${best.platform}` : undefined}
        />
        <MetricCard label="Content pieces" value={String(filtered.length)} sub={`in the last ${PERIOD_DAYS[period]} days`} />
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 20px 12px", background: "#fff", marginBottom: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Top content by views</h3>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={formatNumber} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={145} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [formatNumber(Number(v)), "Views"]} />
                <Bar dataKey="views" radius={[0, 4, 4, 0]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Content table */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>All content</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{DEMO_CONTENT.length} items</span>
        </div>
        {DEMO_CONTENT.slice(0, 8).map((item, i) => {
          const badge = PLATFORM_BADGE[item.platform] ?? { bg: "#f3f4f6", color: "#374151" };
          return (
            <button
              key={item.contentId}
              onClick={() => onSelectContent(item)}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "12px 16px",
                borderTop: i > 0 ? "1px solid #f9fafb" : undefined,
                background: "#fff",
                border: "none",
                borderRadius: 0,
                cursor: "pointer",
                textAlign: "left",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: badge.bg, color: badge.color }}>
                    {item.platform}
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(item.publishedAt)}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{formatNumber(item.totalViews)}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.engagementRate.toFixed(1)}% eng</div>
              </div>
              <span style={{ color: "#d1d5db", fontSize: 16 }}>›</span>
            </button>
          );
        })}
      </div>
    </DemoCard>
  );
}

// ─── Insight card (used in dashboard) ────────────────────────────────────────

const CONFIDENCE_BADGE: Record<string, { bg: string; color: string }> = {
  Strong: { bg: "#dcfce7", color: "#15803d" },
  Moderate: { bg: "#fef9c3", color: "#854d0e" },
  Emerging: { bg: "#dbeafe", color: "#1e40af" },
};

const INSIGHT_ICONS: Record<string, string> = {
  day_of_week: "📅",
  content_type: "🎬",
  length_bucket: "⏱️",
  posting_frequency: "📈",
};

function InsightCard({
  insight,
  expanded,
  onToggle,
  onDismiss,
}: {
  insight: DemoInsight;
  expanded: boolean;
  onToggle: () => void;
  onDismiss: () => void;
}) {
  const badge = CONFIDENCE_BADGE[insight.confidence_label];
  const icon = INSIGHT_ICONS[insight.insight_type] ?? "💡";

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
      <div style={{ padding: "16px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af" }}>
            {insight.insight_type.replace(/_/g, " ")}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: badge.bg, color: badge.color }}>
              {insight.confidence_label}
            </span>
            <button
              onClick={onDismiss}
              style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer", color: "#9ca3af", fontSize: 12 }}
            >
              ✕
            </button>
          </div>
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 6px", lineHeight: 1.45 }}>{insight.summary}</p>
        <p style={{ fontSize: 13, color: "#4b5563", margin: "0 0 10px", lineHeight: 1.6 }}>{insight.narrative}</p>
      </div>
      {insight.supporting_content.length > 0 && (
        <>
          <button
            onClick={onToggle}
            style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "9px 18px", background: expanded ? "#f9fafb" : "transparent", border: "none", borderTop: "1px solid #f3f4f6", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#6b7280", textAlign: "left" }}
          >
            <span style={{ display: "inline-block", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", fontSize: 10 }}>▶</span>
            {expanded ? "Hide" : "Show"} contributing content ({insight.supporting_content.length})
          </button>
          {expanded && (
            <div style={{ background: "#f9fafb", padding: "12px 18px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {insight.supporting_content.map((item, i) => {
                const b = PLATFORM_BADGE[item.platform] ?? { bg: "#f3f4f6", color: "#374151" };
                return (
                  <div key={item.contentId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#d1d5db", width: 16 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: b.bg, color: b.color }}>{item.platform}</span>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{formatNumber(item.totalViews)} views</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Step 5: Content detail ───────────────────────────────────────────────────

function StepContentDetail({ content, onBack }: { content: DemoContentItem; onBack: () => void }) {
  const [metric, setMetric] = useState<"views" | "engagement">("views");
  const badge = PLATFORM_BADGE[content.platform] ?? { bg: "#f3f4f6", color: "#374151" };

  const snaps = DEMO_SNAPSHOTS.filter((s) => s.contentId === content.contentId).sort((a, b) => a.dayMark - b.dayMark);
  const latest = snaps[snaps.length - 1];

  // Build chart data
  const chartData = [1, 7, 30].map((dm) => {
    const snap = snaps.find((s) => s.dayMark === dm);
    return {
      label: `Day ${dm}`,
      views: snap?.views ?? null,
      engagement: snap?.engagementRate ?? null,
    };
  });

  const derivativeChildren = [
    { id: "ig-001", title: "Next.js + Supabase SaaS setup (carousel)", platform: "instagram", publishedAt: daysAgo(7), views: 14_200, eng: 4.1 },
    { id: "tw-001", title: "Twitter thread: SaaS in 48 hours", platform: "twitter", publishedAt: daysAgo(7), views: 8_400, eng: 3.2 },
  ];

  function daysAgo(d: number) {
    return new Date(Date.now() - d * 86_400_000).toISOString();
  }

  return (
    <DemoCard
      title="Step 5 — Content deep dive"
      description="Clicking any content item shows the individual performance page — with a day-1 / day-7 / day-30 snapshot timeline and a list of derivative (repurposed) content generated from this piece."
    >
      {/* Back link */}
      <div style={{ marginBottom: 20, fontSize: 13, color: "#6b7280" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0 }}>
          ← Back to dashboard
        </button>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ background: badge.bg, color: badge.color, borderRadius: 5, padding: "3px 10px", fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>
            {content.platform}
          </span>
          <span style={{ color: "#9ca3af", fontSize: 13 }}>Published {formatDate(content.publishedAt)}</span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#111827", lineHeight: 1.3 }}>{content.title}</h1>
        {content.description && (
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>{content.description}</p>
        )}
      </div>

      {/* Stat cards */}
      {latest && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          <MetricCard label="Views (day 30)" value={formatNumber(latest.views)} />
          <MetricCard label="Engagement rate" value={`${latest.engagementRate.toFixed(2)}%`} />
          {content.watchTimeMinutes && (
            <MetricCard label="Watch time" value={formatNumber(content.watchTimeMinutes)} sub="minutes total" />
          )}
          {content.durationSeconds && (
            <MetricCard label="Duration" value={`${Math.round(content.durationSeconds / 60)} min`} />
          )}
        </div>
      )}

      {/* Performance chart */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "18px 20px 14px", background: "#fff", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Performance timeline</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {(["views", "engagement"] as const).map((m) => (
              <button key={m} onClick={() => setMetric(m)} style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid", borderColor: metric === m ? "#2563eb" : "#e5e7eb", background: metric === m ? "#2563eb" : "#fff", color: metric === m ? "#fff" : "#374151", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                {m === "views" ? "Views" : "Engagement %"}
              </button>
            ))}
          </div>
        </div>
        {snaps.length > 0 ? (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={metric === "views" ? formatNumber : (v) => `${v}%`} tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v: number | undefined) => [v == null ? "—" : metric === "views" ? formatNumber(v) : `${v.toFixed(2)}%`, metric === "views" ? "Views" : "Engagement"]} />
                <Line type="monotone" dataKey={metric} stroke={PLATFORM_COLORS[content.platform] ?? "#2563eb"} strokeWidth={2.5} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 8 }}>
            Snapshots not yet recorded for this content.
          </div>
        )}
      </div>

      {/* Derivative children */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Derivative content (repurposed)</h3>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          {derivativeChildren.map((child, i) => {
            const b = PLATFORM_BADGE[child.platform] ?? { bg: "#f3f4f6", color: "#374151" };
            return (
              <div key={child.id} style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderTop: i > 0 ? "1px solid #f3f4f6" : undefined, background: "#fff", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{child.title}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: b.bg, color: b.color }}>{child.platform}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(child.publishedAt)}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatNumber(child.views)} <span style={{ fontWeight: 400, color: "#6b7280" }}>views</span></div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{child.eng}% eng</div>
                </div>
                <span style={{ color: "#d1d5db" }}>›</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 24, padding: "14px 16px", background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe", fontSize: 13, color: "#1e40af" }}>
        <strong>Next:</strong> Start a repurpose job to turn this YouTube video into Twitter threads, LinkedIn posts, Instagram captions, and more.
      </div>
    </DemoCard>
  );
}

// ─── Step 6: Repurpose new ────────────────────────────────────────────────────

function StepRepurposeNew({ onNext }: { onNext: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const source = DEMO_CONTENT[4]; // "I Built a SaaS in 48 Hours"

  return (
    <DemoCard
      title="Step 6 — Start a repurpose job"
      description="Users paste a YouTube URL or raw transcript. Meridian extracts the transcript using Whisper and generates derivative formats via Claude AI — Twitter threads, LinkedIn posts, Instagram captions, and more."
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Source content card */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Source content</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg height="18" viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M27.976 3.14A3.514 3.514 0 0 0 25.5.648C23.28 0 14 0 14 0S4.72 0 2.5.648A3.514 3.514 0 0 0 .024 3.14C-.648 5.373 0 10 0 10s-.648 4.627.024 6.86A3.514 3.514 0 0 0 2.5 19.352C4.72 20 14 20 14 20s9.28 0 11.5-.648a3.514 3.514 0 0 0 2.476-2.492C28.648 14.627 28 10 28 10s.648-4.627-.024-6.86z" fill="#FF0000"/>
                <path d="M11.2 14.286 18.4 10l-7.2-4.286v8.572z" fill="#fff"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{source.title}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                {formatNumber(source.totalViews)} views · {Math.round((source.durationSeconds ?? 0) / 60)} min · Published {formatDate(source.publishedAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Format selection */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Formats to generate</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { key: "twitter_thread", label: "Twitter / X Thread", checked: true },
              { key: "linkedin_post", label: "LinkedIn Post", checked: true },
              { key: "instagram_caption", label: "Instagram Caption", checked: true },
              { key: "newsletter_blurb", label: "Newsletter Blurb", checked: true },
            ].map((f) => (
              <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: f.checked ? "#eff6ff" : "#fff", borderColor: f.checked ? "#bfdbfe" : "#e5e7eb" }}>
                <input type="checkbox" defaultChecked={f.checked} style={{ accentColor: "#2563eb" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Generate button */}
        {!done ? (
          <button
            onClick={() => { setGenerating(true); setTimeout(() => { setDone(true); setTimeout(onNext, 600); }, 2000); }}
            disabled={generating}
            style={{ width: "100%", padding: "12px 24px", borderRadius: 8, border: "none", background: generating ? "#93c5fd" : "#2563eb", color: "#fff", fontWeight: 700, fontSize: 15, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {generating ? (
              <>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 16 }}>⟳</span>
                Generating derivatives…
              </>
            ) : (
              "Generate repurposed content →"
            )}
          </button>
        ) : (
          <div style={{ width: "100%", padding: "12px 24px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", fontWeight: 600, fontSize: 14, textAlign: "center" }}>
            ✓ 4 derivatives generated — opening review…
          </div>
        )}

        {generating && !done && (
          <div style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <ProgressStep label="Fetching transcript via YouTube API" done={true} />
              <ProgressStep label="Extracting key themes and takeaways" done={true} />
              <ProgressStep label="Generating Twitter thread with Claude AI" done={false} active={true} />
              <ProgressStep label="Generating LinkedIn post" done={false} active={false} />
              <ProgressStep label="Generating Instagram caption" done={false} active={false} />
              <ProgressStep label="Generating newsletter blurb" done={false} active={false} />
            </div>
          </div>
        )}
      </div>
    </DemoCard>
  );
}

function ProgressStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 14 }}>{done ? "✅" : active ? "⟳" : "○"}</span>
      <span style={{ fontSize: 13, color: done ? "#16a34a" : active ? "#2563eb" : "#9ca3af" }}>{label}</span>
    </div>
  );
}

// ─── Step 7: Review derivatives ───────────────────────────────────────────────

function StepRepurposeReview({
  derivatives,
  onApprove,
  onNext,
}: {
  onNext: () => void;
  derivatives: DemoDerivative[];
  onApprove: (format: string) => void;
}) {
  const [activeTab, setActiveTab] = useState(derivatives[0]?.format ?? "");
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});

  const active = derivatives.find((d) => d.format === activeTab);
  const content = editingContent[activeTab] ?? active?.content ?? "";

  const approvedCount = derivatives.filter((d) => d.status === "approved").length;

  return (
    <DemoCard
      title="Step 7 — Review & approve derivatives"
      description="Each generated format is shown in a card. Users can edit the content directly, then approve or reject it. Approved derivatives can be published immediately or scheduled."
    >
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Formats</div>
          {derivatives.map((d) => {
            const b = PLATFORM_BADGE[d.platform] ?? { bg: "#f3f4f6", color: "#374151" };
            return (
              <button
                key={d.format}
                onClick={() => setActiveTab(d.format)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "9px 12px",
                  marginBottom: 4,
                  borderRadius: 8,
                  border: `1px solid ${activeTab === d.format ? "#bfdbfe" : "#e5e7eb"}`,
                  background: activeTab === d.format ? "#eff6ff" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: b.bg, color: b.color, flexShrink: 0 }}>
                  {d.platform}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
                {d.status === "approved" && <span style={{ marginLeft: "auto", fontSize: 12 }}>✅</span>}
              </button>
            );
          })}
          <div style={{ marginTop: 12, padding: "8px 12px", background: approvedCount === derivatives.length ? "#f0fdf4" : "#f9fafb", borderRadius: 8, fontSize: 12, color: approvedCount === derivatives.length ? "#15803d" : "#6b7280" }}>
            {approvedCount}/{derivatives.length} approved
          </div>
        </div>

        {/* Content area */}
        {active && (
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{active.label}</h3>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{content.length} chars</span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setEditingContent((prev) => ({ ...prev, [activeTab]: e.target.value }))}
              style={{
                width: "100%",
                minHeight: 320,
                padding: "14px 16px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 13,
                lineHeight: 1.65,
                resize: "vertical",
                fontFamily: "inherit",
                color: "#111827",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              {active.status !== "approved" ? (
                <button
                  onClick={() => {
                    onApprove(active.format);
                    // Move to next unreviewed
                    const nextUnapproved = derivatives.find((d) => d.format !== active.format && d.status !== "approved");
                    if (nextUnapproved) setActiveTab(nextUnapproved.format);
                  }}
                  style={{ padding: "9px 18px", borderRadius: 7, border: "none", background: "#16a34a", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  ✓ Approve
                </button>
              ) : (
                <div style={{ padding: "9px 18px", borderRadius: 7, background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", fontWeight: 600, fontSize: 13 }}>
                  ✓ Approved
                </div>
              )}
              <button
                style={{ padding: "9px 18px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                ↺ Regenerate
              </button>
            </div>
          </div>
        )}
      </div>

      {approvedCount > 0 && (
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onNext}
            style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Schedule approved derivatives →
          </button>
        </div>
      )}
    </DemoCard>
  );
}

// ─── Step 8: Publish calendar ─────────────────────────────────────────────────

function StepPublishCalendar({ derivatives }: { derivatives: DemoDerivative[] }) {
  const approved = derivatives.filter((d) => d.status === "approved");
  const now = new Date();

  // Suggested schedule times (optimal times from pattern insight)
  const schedules = approved.map((d, i) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + (i === 0 ? 1 : i === 1 ? 3 : i === 2 ? 5 : 7));
    dt.setHours(9, 0, 0, 0); // Wednesday 9am per insight
    return {
      ...d,
      scheduledAt: dt.toISOString(),
      suggested: true,
    };
  });

  const [published, setPublished] = useState<Set<string>>(new Set());
  const [scheduled, setScheduled] = useState<Set<string>>(new Set());

  return (
    <DemoCard
      title="Step 8 — Schedule & publish"
      description="Approved derivatives can be published immediately or scheduled. Meridian suggests optimal posting times based on your pattern insights (e.g., Wednesdays at 9am)."
    >
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 13, color: "#78350f" }}>
        💡 <strong>Insight applied:</strong> Publishing on Wednesday drives 2.3× more views in the first 7 days. Suggested times reflect this.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {schedules.map((item) => {
          const b = PLATFORM_BADGE[item.platform] ?? { bg: "#f3f4f6", color: "#374151" };
          const isPublished = published.has(item.format);
          const isScheduled = scheduled.has(item.format);

          return (
            <div key={item.format} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 18px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: b.bg, color: b.color }}>{item.platform}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {item.suggested && "⏰ Suggested: "}
                  {new Date(item.scheduledAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at{" "}
                  {new Date(item.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {isPublished ? (
                  <div style={{ padding: "7px 14px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", fontWeight: 600, fontSize: 12 }}>
                    ✓ Published
                  </div>
                ) : isScheduled ? (
                  <div style={{ padding: "7px 14px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a", color: "#78350f", fontWeight: 600, fontSize: 12 }}>
                    ⏰ Scheduled
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setPublished((s) => new Set([...s, item.format]))}
                      style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: PLATFORM_COLORS[item.platform] ?? "#2563eb", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                    >
                      Publish now
                    </button>
                    <button
                      onClick={() => setScheduled((s) => new Set([...s, item.format]))}
                      style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                    >
                      Schedule
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{ marginTop: 28, padding: "20px 22px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>Demo complete — what was demonstrated</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {[
            { icon: "🔐", label: "Google Sign-In", detail: "OAuth 2.0 with openid, email, profile scopes" },
            { icon: "▶️", label: "YouTube API connection", detail: "youtube.readonly + yt-analytics.readonly" },
            { icon: "📊", label: "Analytics dashboard", detail: "Views, engagement, watch time by content" },
            { icon: "💡", label: "AI pattern insights", detail: "Day-of-week, length, frequency analysis" },
            { icon: "✂️", label: "Content repurposing", detail: "Transcript → Twitter / LinkedIn / Instagram / Newsletter" },
            { icon: "📅", label: "Scheduled publishing", detail: "Optimal-time suggestions from insight data" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", gap: 10, padding: "8px 0" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoCard>
  );
}

// ─── Shared UI components ─────────────────────────────────────────────────────

interface NavProps {
  onNext: () => void;
  onBack: () => void;
}

function DemoCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>{title}</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.6, maxWidth: 640 }}>{description}</p>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", background: "#fff" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ScopeBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", background: "#f9fafb" }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280" }}>
          {title}
        </span>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function ScopeRow({ icon, scope, detail }: { icon: string; scope: string; detail: string }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{scope}</div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{detail}</div>
      </div>
    </div>
  );
}
