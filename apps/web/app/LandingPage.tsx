import Link from "next/link";

const FEATURES = [
  {
    title: "Unified Analytics",
    description:
      "See views, engagement, and watch time across YouTube, Instagram, and newsletters — all in one dashboard.",
    icon: "📊",
  },
  {
    title: "AI Content Repurposing",
    description:
      "Turn a single video or blog post into Twitter threads, LinkedIn posts, TikTok scripts, and more — automatically.",
    icon: "🔄",
  },
  {
    title: "Pattern Insights",
    description:
      "Discover your best posting days, optimal content length, and which formats drive the most engagement.",
    icon: "💡",
  },
  {
    title: "Cross-Platform Comparison",
    description:
      "Compare performance metrics across every connected platform side-by-side with interactive charts.",
    icon: "📈",
  },
];

const PLATFORMS = [
  { name: "YouTube", color: "#dc2626" },
  { name: "Instagram", color: "#7c3aed" },
  { name: "Beehiiv", color: "#f97316" },
  { name: "TikTok", color: "#010101" },
  { name: "Substack", color: "#ff6719" },
  { name: "Patreon", color: "#ff424d" },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section
        style={{
          position: "relative",
          padding: "80px 24px 72px",
          textAlign: "center",
          background:
            "linear-gradient(135deg, #f8f9fb 0%, #eef2ff 40%, #f5f3ff 70%, #fdf2f8 100%)",
          overflow: "hidden",
        }}
      >
        {/* Decorative gradient orbs */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -120,
            left: "20%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -80,
            right: "15%",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            position: "relative",
            animation: "fadeSlideIn 0.5s ease-out",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 16px",
              borderRadius: 99,
              background: "rgba(255,255,255,0.8)",
              border: "1px solid #e5e7eb",
              fontSize: 13,
              fontWeight: 600,
              color: "#6b7280",
              marginBottom: 24,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            Free to get started
          </div>

          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              color: "#111827",
              margin: "0 0 16px",
            }}
          >
            Know what works.
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Ship it everywhere.
            </span>
          </h1>

          <p
            style={{
              fontSize: "clamp(16px, 2vw, 19px)",
              color: "#6b7280",
              lineHeight: 1.6,
              margin: "0 auto 36px",
              maxWidth: 520,
            }}
          >
            Meridian unifies your content analytics, surfaces what performs best,
            and repurposes your top content across every platform — all in one place.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 28px",
                borderRadius: 10,
                background: "#111827",
                color: "#fff",
                fontWeight: 600,
                fontSize: 16,
                textDecoration: "none",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              Get started free
              <span style={{ fontSize: 18 }}>→</span>
            </Link>
          </div>

          {/* Platform pills */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              alignItems: "center",
              marginTop: 32,
              flexWrap: "wrap",
              maxWidth: 600,
              margin: "32px auto 0",
            }}
          >
            {PLATFORMS.map((p) => (
              <span
                key={p.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 14px",
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.7)",
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: p.color,
                  }}
                />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "64px 24px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#111827",
              margin: "0 0 8px",
            }}
          >
            Everything you need to grow
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#6b7280",
              margin: 0,
              maxWidth: 480,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Stop jumping between tabs. See the full picture of your content
            performance.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
            maxWidth: 680,
            margin: "0 auto",
          }}
        >
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: "28px 24px",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  marginBottom: 12,
                }}
              >
                {feature.icon}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                  margin: "0 0 6px",
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "#6b7280",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section
        style={{
          background: "#fff",
          borderTop: "1px solid #e5e7eb",
          padding: "64px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#111827",
              margin: "0 0 8px",
            }}
          >
            Simple, transparent pricing
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#6b7280",
              margin: "0 0 40px",
            }}
          >
            Start free. Upgrade as you grow.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              textAlign: "left",
            }}
          >
            {/* Free */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: "28px 24px",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                Free
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#111827" }}>
                $0
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: "#9ca3af",
                  }}
                >
                  /mo
                </span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 14,
                  color: "#374151",
                }}
              >
                <li>1 platform</li>
                <li>5 repurpose jobs/mo</li>
                <li>Basic analytics</li>
              </ul>
            </div>

            {/* Creator */}
            <div
              style={{
                border: "2px solid #2563eb",
                borderRadius: 14,
                padding: "28px 24px",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: 24,
                  background: "#2563eb",
                  color: "#fff",
                  padding: "3px 12px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Popular
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#2563eb",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                Creator
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#111827" }}>
                $19
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: "#9ca3af",
                  }}
                >
                  /mo
                </span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 14,
                  color: "#374151",
                }}
              >
                <li>3 platforms</li>
                <li>20 repurpose jobs/mo</li>
                <li>Pattern insights</li>
              </ul>
            </div>

            {/* Pro */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: "28px 24px",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                Pro
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#111827" }}>
                $49
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: "#9ca3af",
                  }}
                >
                  /mo
                </span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 14,
                  color: "#374151",
                }}
              >
                <li>Unlimited platforms</li>
                <li>Unlimited repurposing</li>
                <li>Priority support</li>
              </ul>
            </div>
          </div>

          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              borderRadius: 10,
              background: "#111827",
              color: "#fff",
              fontWeight: 600,
              fontSize: 16,
              textDecoration: "none",
              marginTop: 36,
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
          >
            Get started free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #e5e7eb",
          padding: "24px",
          textAlign: "center",
          fontSize: 13,
          color: "#9ca3af",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span>© {new Date().getFullYear()} Meridian by Banton Digital. All rights reserved.</span>
        <div style={{ display: "flex", gap: 20 }}>
          <Link
            href="/terms"
            style={{ color: "#9ca3af", textDecoration: "none" }}
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            style={{ color: "#9ca3af", textDecoration: "none" }}
          >
            Privacy Policy
          </Link>
        </div>
      </footer>
    </main>
  );
}
