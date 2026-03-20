"use client";

import { useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = "creator" | "pro";

interface PlanConfig {
  label: string;
  price: string;
  description: string;
  features: string[];
  color: string;
}

const PLANS: Record<Plan, PlanConfig> = {
  creator: {
    label: "Creator",
    price: "$19 / month",
    description: "For serious creators ready to grow smarter.",
    features: [
      "All free features",
      "Unlimited content sync",
      "AI pattern insights",
      "Content repurposing (20/mo)",
    ],
    color: "#2563eb",
  },
  pro: {
    label: "Pro",
    price: "$49 / month",
    description: "For professional creators scaling across platforms.",
    features: [
      "Everything in Creator",
      "Unlimited repurposing",
      "Priority support",
      "Early access to new features",
    ],
    color: "#7c3aed",
  },
};

const TIER_COLORS: Record<"free" | "creator" | "pro", string> = {
  free: "#6b7280",
  creator: "#2563eb",
  pro: "#7c3aed",
};

// ─── Usage summary card ───────────────────────────────────────────────────────

function UsageSummaryCard({
  currentTier,
  repurposeJobsUsed,
  repurposeJobsLimit,
  nextBillingDate,
  trialEndsAt,
}: {
  currentTier: "free" | "creator" | "pro";
  repurposeJobsUsed: number;
  repurposeJobsLimit: number | null;
  nextBillingDate: string | null;
  trialEndsAt: string | null;
}) {
  const tierColor = TIER_COLORS[currentTier];
  const tierLabel =
    currentTier === "free"
      ? "Free"
      : currentTier === "creator"
      ? "Creator"
      : "Pro";

  const usageLabel =
    repurposeJobsLimit === null
      ? `${repurposeJobsUsed} / ∞`
      : `${repurposeJobsUsed} / ${repurposeJobsLimit}`;

  const usagePct =
    repurposeJobsLimit === null
      ? 0
      : Math.min((repurposeJobsUsed / repurposeJobsLimit) * 100, 100);

  const trialExpiryLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 24,
        marginBottom: 28,
        background: "#f9fafb",
      }}
    >
      {/* Trial banner */}
      {trialEndsAt && trialExpiryLabel && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#1d4ed8",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 700 }}>Trial active</span>
          <span style={{ color: "#3b82f6" }}>·</span>
          <span>
            Your <strong>{tierLabel}</strong> trial ends on{" "}
            <strong>{trialExpiryLabel}</strong>. Subscribe before then to keep
            access.
          </span>
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#111827" }}>
        Current usage
      </h2>

      <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
        {/* Plan */}
        <div
          style={{
            flex: "1 1 140px",
            paddingRight: 24,
            borderRight: "1px solid #e5e7eb",
            marginRight: 24,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
            Plan
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: tierColor,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 700, color: tierColor }}>
              {tierLabel}
            </span>
          </div>
        </div>

        {/* Repurpose jobs */}
        <div
          style={{
            flex: "1 1 160px",
            paddingRight: 24,
            borderRight: nextBillingDate ? "1px solid #e5e7eb" : undefined,
            marginRight: nextBillingDate ? 24 : 0,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
            Repurpose jobs
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
            {usageLabel}
            <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", marginLeft: 4 }}>
              this month
            </span>
          </div>
          {repurposeJobsLimit !== null && (
            <div
              style={{
                height: 4,
                background: "#e5e7eb",
                borderRadius: 99,
                overflow: "hidden",
                maxWidth: 140,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${usagePct}%`,
                  background: usagePct >= 90 ? "#ef4444" : usagePct >= 70 ? "#f59e0b" : "#2563eb",
                  borderRadius: 99,
                  transition: "width 0.3s",
                }}
              />
            </div>
          )}
        </div>

        {/* Next billing date */}
        {nextBillingDate && (
          <div style={{ flex: "1 1 120px", marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
              Next billing
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
              {nextBillingDate}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  config,
  isCurrent,
  onUpgrade,
  loading,
}: {
  plan: Plan;
  config: PlanConfig;
  isCurrent: boolean;
  onUpgrade: (plan: Plan) => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        border: `2px solid ${isCurrent ? config.color : "#e5e7eb"}`,
        borderRadius: 12,
        padding: 24,
        background: isCurrent ? `${config.color}08` : "#fff",
        flex: 1,
        minWidth: 220,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 18 }}>{config.label}</span>
        {isCurrent && (
          <span
            style={{
              background: config.color,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 99,
              letterSpacing: "0.03em",
            }}
          >
            Current plan
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: config.color }}>
        {config.price}
      </div>
      <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 16px" }}>
        {config.description}
      </p>
      <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "#374151", fontSize: 14, lineHeight: 1.8 }}>
        {config.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {!isCurrent && (
        <button
          onClick={() => onUpgrade(plan)}
          disabled={loading}
          style={{
            width: "100%",
            background: loading ? "#d1d5db" : config.color,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 0",
            fontWeight: 700,
            fontSize: 15,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Redirecting…" : `Upgrade to ${config.label}`}
        </button>
      )}
    </div>
  );
}

// ─── Promo code redemption ────────────────────────────────────────────────────

function PromoCodeSection({
  onRedeemed,
}: {
  onRedeemed: (tier: string, trialEndsAt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    { ok: true; message: string } | { ok: false; message: string } | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleToggle() {
    setOpen((v) => !v);
    setResult(null);
    setCode("");
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json() as { tier?: string; trialEndsAt?: string; durationDays?: number; error?: string };
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Failed to redeem code." });
      } else {
        const expiresLabel = new Date(data.trialEndsAt!).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const tierLabel =
          data.tier === "pro" ? "Pro" : data.tier === "creator" ? "Creator" : data.tier!;
        setResult({
          ok: true,
          message: `${tierLabel} trial activated — expires ${expiresLabel}. The page will refresh.`,
        });
        setCode("");
        onRedeemed(data.tier!, data.trialEndsAt!);
      }
    } catch {
      setResult({ ok: false, message: "An unexpected error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        borderTop: "1px solid #e5e7eb",
        paddingTop: 24,
        marginTop: 8,
      }}
    >
      <button
        onClick={handleToggle}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 14,
          color: "#6b7280",
          textDecoration: "underline",
          textDecorationStyle: "dashed",
          textUnderlineOffset: 3,
        }}
      >
        {open ? "Hide promo code" : "Have a promo code?"}
      </button>

      {open && (
        <form
          onSubmit={handleRedeem}
          style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={loading}
            autoFocus
            style={{
              flex: "1 1 180px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 14,
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              outline: "none",
              background: loading ? "#f9fafb" : "#fff",
            }}
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              background: loading || !code.trim() ? "#d1d5db" : "#111827",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 20px",
              fontWeight: 600,
              fontSize: 14,
              cursor: loading || !code.trim() ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Redeeming…" : "Redeem"}
          </button>
        </form>
      )}

      {result && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            background: result.ok ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${result.ok ? "#bbf7d0" : "#fca5a5"}`,
            borderRadius: 8,
            padding: "10px 14px",
            color: result.ok ? "#15803d" : "#b91c1c",
            fontSize: 13,
          }}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BillingClientProps {
  currentTier: "free" | "creator" | "pro";
  hasStripeCustomer: boolean;
  repurposeJobsUsed: number;
  repurposeJobsLimit: number | null;
  nextBillingDate: string | null;
  trialEndsAt: string | null;
}

export default function BillingClient({
  currentTier: initialTier,
  hasStripeCustomer,
  repurposeJobsUsed,
  repurposeJobsLimit,
  nextBillingDate,
  trialEndsAt: initialTrialEndsAt,
}: BillingClientProps) {
  const [currentTier, setCurrentTier] = useState(initialTier);
  const [trialEndsAt, setTrialEndsAt] = useState(initialTrialEndsAt);
  const [checkoutLoading, setCheckoutLoading] = useState<Plan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(plan: Plan) {
    setCheckoutLoading(plan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start checkout.");
        setCheckoutLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setCheckoutLoading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to open billing portal.");
        setPortalLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setPortalLoading(false);
    }
  }

  const isPaid = currentTier === "creator" || currentTier === "pro";

  return (
    <div>
      {/* Usage summary */}
      <UsageSummaryCard
        currentTier={currentTier}
        repurposeJobsUsed={repurposeJobsUsed}
        repurposeJobsLimit={repurposeJobsLimit}
        nextBillingDate={nextBillingDate}
        trialEndsAt={trialEndsAt}
      />

      {/* Current tier banner for free users */}
      {currentTier === "free" && (
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 28,
            fontSize: 14,
            color: "#374151",
          }}
        >
          You are on the <strong>Free</strong> plan. Upgrade to unlock more features.
        </div>
      )}

      {/* Plan cards */}
      <div
        style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}
      >
        {(Object.entries(PLANS) as [Plan, PlanConfig][]).map(([plan, config]) => (
          <PlanCard
            key={plan}
            plan={plan}
            config={config}
            isCurrent={currentTier === plan}
            onUpgrade={handleUpgrade}
            loading={checkoutLoading === plan}
          />
        ))}
      </div>

      {/* Billing portal for paying customers */}
      {(isPaid || hasStripeCustomer) && (
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: 24,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>
            Manage billing
          </h2>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 14px" }}>
            Update your payment method, download invoices, or cancel your
            subscription in the Stripe Customer Portal.
          </p>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            style={{
              background: portalLoading ? "#d1d5db" : "#111827",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 600,
              fontSize: 14,
              cursor: portalLoading ? "not-allowed" : "pointer",
            }}
          >
            {portalLoading ? "Opening portal…" : "Manage billing →"}
          </button>
        </div>
      )}

      {/* Promo code redemption */}
      <PromoCodeSection
        onRedeemed={(tier, endsAt) => {
          setCurrentTier(tier as "free" | "creator" | "pro");
          setTrialEndsAt(endsAt);
          // Reload after a brief delay so the server-rendered tier data
          // refreshes without jarring the success message.
          setTimeout(() => window.location.reload(), 2500);
        }}
      />

      {/* Error message */}
      {error && (
        <div
          role="alert"
          style={{
            marginTop: 20,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "12px 16px",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
