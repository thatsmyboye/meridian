"use client";

import { useState } from "react";

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
}: {
  currentTier: "free" | "creator" | "pro";
  repurposeJobsUsed: number;
  repurposeJobsLimit: number | null;
  nextBillingDate: string | null;
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

// ─── Main component ───────────────────────────────────────────────────────────

interface BillingClientProps {
  currentTier: "free" | "creator" | "pro";
  hasStripeCustomer: boolean;
  repurposeJobsUsed: number;
  repurposeJobsLimit: number | null;
  nextBillingDate: string | null;
}

export default function BillingClient({
  currentTier,
  hasStripeCustomer,
  repurposeJobsUsed,
  repurposeJobsLimit,
  nextBillingDate,
}: BillingClientProps) {
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
