import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Meridian",
  description: "Privacy Policy for Meridian by Banton Digital.",
};

const EFFECTIVE_DATE = "March 10, 2026";

const sectionStyle: React.CSSProperties = {
  marginBottom: 40,
};

const h2Style: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#111827",
  margin: "0 0 12px",
};

const pStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#374151",
  lineHeight: 1.7,
  margin: "0 0 12px",
};

const ulStyle: React.CSSProperties = {
  margin: "0 0 12px",
  paddingLeft: 24,
};

const liStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#374151",
  lineHeight: 1.7,
  marginBottom: 6,
};

const linkStyle: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "underline",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
  color: "#374151",
  marginBottom: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontWeight: 600,
  padding: "8px 12px",
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #e5e7eb",
  verticalAlign: "top",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        padding: "48px 24px 80px",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          padding: "48px 56px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              color: "#6b7280",
              textDecoration: "none",
              marginBottom: 32,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Meridian
          </Link>

          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#111827",
              margin: "0 0 8px",
            }}
          >
            Privacy Policy
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Effective date: {EFFECTIVE_DATE}
          </p>
        </div>

        <div style={sectionStyle}>
          <p style={pStyle}>
            Banton Digital (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates Meridian (the
            &quot;Service&quot;). This Privacy Policy explains what information we collect,
            how we use it, and the choices you have. By using the Service, you
            agree to the practices described here.
          </p>
        </div>

        {/* 1 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>1. Information We Collect</h2>

          <p style={{ ...pStyle, fontWeight: 600, marginBottom: 4 }}>
            Account Information
          </p>
          <p style={pStyle}>
            When you sign in with Google, we receive your name, email address,
            and profile picture from Google&apos;s OAuth service. We store your email
            and display name to identify your account.
          </p>

          <p style={{ ...pStyle, fontWeight: 600, marginBottom: 4 }}>
            Connected Platform Data
          </p>
          <p style={pStyle}>
            When you connect a platform (YouTube, Instagram, TikTok, Twitter/X,
            LinkedIn, Beehiiv), we store the OAuth tokens or API credentials
            necessary to fetch your analytics on your behalf. These credentials
            are encrypted at rest. We retrieve content metadata and performance
            metrics (views, likes, comments, shares, reach, etc.) from those
            platforms.
          </p>

          <p style={{ ...pStyle, fontWeight: 600, marginBottom: 4 }}>
            Content You Import
          </p>
          <p style={pStyle}>
            If you use the AI repurposing features, we temporarily process the
            content you provide (text, titles, descriptions) to generate
            derivatives. This content is associated with your account.
          </p>

          <p style={{ ...pStyle, fontWeight: 600, marginBottom: 4 }}>
            Usage and Analytics Data
          </p>
          <p style={pStyle}>
            We use PostHog to collect anonymous usage data, including pages
            visited, features used, and interaction events. This helps us
            understand how the Service is used and how to improve it. IP
            addresses may be collected as part of this process.
          </p>

          <p style={{ ...pStyle, fontWeight: 600, marginBottom: 4 }}>
            Payment Information
          </p>
          <p style={pStyle}>
            Payment processing is handled by Stripe. We do not store full
            payment card details. We store your Stripe customer ID and
            subscription status in order to manage your plan.
          </p>

          <p style={{ ...pStyle, fontWeight: 600, marginBottom: 4 }}>
            Mobile Push Tokens
          </p>
          <p style={pStyle}>
            If you use the Meridian mobile app and enable notifications, we
            store a push notification token associated with your account.
          </p>
        </div>

        {/* 2 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>2. How We Use Your Information</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Purpose</th>
                <th style={thStyle}>Information Used</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Provide and operate the Service", "Account info, platform data, content"],
                ["Generate AI content derivatives", "Content you import or connect"],
                ["Process subscription payments", "Stripe customer ID, subscription status"],
                ["Send product notifications", "Email address, push tokens"],
                ["Analyze and improve the Service", "Usage data (PostHog)"],
                ["Prevent fraud and abuse", "Account info, usage data"],
              ].map(([purpose, info]) => (
                <tr key={purpose}>
                  <td style={tdStyle}>{purpose}</td>
                  <td style={tdStyle}>{info}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={pStyle}>
            We do not sell your personal information to third parties.
          </p>
        </div>

        {/* 3 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>3. How We Share Your Information</h2>
          <p style={pStyle}>
            We share your information only as necessary to operate the Service:
          </p>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <strong>Supabase</strong> — our database and authentication
              infrastructure provider. Your data is stored in Supabase-managed
              PostgreSQL databases.
            </li>
            <li style={liStyle}>
              <strong>Stripe</strong> — payment processing. Stripe receives
              billing details required to process your subscription.
            </li>
            <li style={liStyle}>
              <strong>PostHog</strong> — product analytics. Usage events are
              sent to PostHog for analysis. Data may be pseudonymized.
            </li>
            <li style={liStyle}>
              <strong>Anthropic / OpenAI</strong> — AI model providers. Content
              you submit for repurposing is sent to these APIs to generate
              derivatives. Refer to their respective privacy policies for how
              they handle API inputs.
            </li>
            <li style={liStyle}>
              <strong>Inngest</strong> — background job processing. Job
              payloads may include content metadata needed to execute tasks.
            </li>
            <li style={liStyle}>
              <strong>Resend</strong> — transactional email delivery.
            </li>
            <li style={liStyle}>
              <strong>Third-party platforms</strong> — when you authorize a
              connection (e.g., YouTube), we interact with that platform&apos;s API
              on your behalf.
            </li>
            <li style={liStyle}>
              <strong>Legal requirements</strong> — we may disclose information
              if required by law or to protect our rights or the safety of
              others.
            </li>
          </ul>
        </div>

        {/* 4 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>4. Data Retention</h2>
          <p style={pStyle}>
            We retain your data for as long as your account is active or as
            needed to provide the Service. If you delete your account, we will
            delete or anonymize your personal data within a reasonable period,
            except where we are required to retain it for legal or billing
            purposes.
          </p>
          <p style={pStyle}>
            Analytics snapshots and AI-generated derivatives are retained to
            support the historical analytics features of the Service.
          </p>
        </div>

        {/* 5 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>5. Cookies and Tracking</h2>
          <p style={pStyle}>
            The Service uses cookies and similar technologies to maintain your
            session (via Supabase Auth) and to track usage analytics (via
            PostHog). These are necessary for the Service to function correctly.
          </p>
          <p style={pStyle}>
            By using the Service, you consent to the use of these cookies. Most
            browsers allow you to control cookies through their settings.
            Disabling session cookies will prevent you from signing in.
          </p>
        </div>

        {/* 6 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>6. Security</h2>
          <p style={pStyle}>
            We take reasonable technical and organizational measures to protect
            your information, including encryption of OAuth tokens and API
            credentials at rest, and use of HTTPS for data in transit. However,
            no system is completely secure, and we cannot guarantee the absolute
            security of your data.
          </p>
        </div>

        {/* 7 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>7. Your Choices</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <strong>Disconnect a platform:</strong> You can revoke Meridian&apos;s
              access to any connected platform at any time from the Settings &gt;
              Connections page or directly from the third-party platform&apos;s
              settings.
            </li>
            <li style={liStyle}>
              <strong>Cancel your subscription:</strong> You can manage or
              cancel your subscription from Settings &gt; Billing.
            </li>
            <li style={liStyle}>
              <strong>Delete your account:</strong> To request account deletion,
              contact us at{" "}
              <a href="mailto:paul@banton-digital.com" style={linkStyle}>
                paul@banton-digital.com
              </a>
              .
            </li>
            <li style={liStyle}>
              <strong>Access or correct your data:</strong> Contact us at the
              email below to request a copy of the personal data we hold about
              you or to correct inaccuracies.
            </li>
          </ul>
        </div>

        {/* 8 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>8. Children&apos;s Privacy</h2>
          <p style={pStyle}>
            The Service is not directed to children under 13. We do not
            knowingly collect personal information from children under 13. If
            you believe a child has provided us with personal information,
            contact us and we will delete it promptly.
          </p>
        </div>

        {/* 9 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>9. Changes to This Policy</h2>
          <p style={pStyle}>
            We may update this Privacy Policy from time to time. We will update
            the effective date at the top of this page. For material changes, we
            will make reasonable efforts to notify you (for example, via email).
            Continued use of the Service after changes take effect constitutes
            acceptance of the updated policy.
          </p>
        </div>

        {/* 10 */}
        <div style={{ ...sectionStyle, marginBottom: 0 }}>
          <h2 style={h2Style}>10. Contact</h2>
          <p style={pStyle}>
            If you have questions or concerns about this Privacy Policy or your
            data, contact us at:
          </p>
          <p style={{ ...pStyle, margin: 0 }}>
            Banton Digital
            <br />
            West Orange, NJ, USA
            <br />
            <a href="mailto:paul@banton-digital.com" style={linkStyle}>
              paul@banton-digital.com
            </a>
          </p>
          <p style={{ ...pStyle, marginTop: 16, marginBottom: 0 }}>
            You may also review our{" "}
            <Link href="/terms" style={linkStyle}>
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
