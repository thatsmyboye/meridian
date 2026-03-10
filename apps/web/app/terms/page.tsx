import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Meridian",
  description: "Terms of Service for Meridian by Banton Digital.",
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

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Effective date: {EFFECTIVE_DATE}
          </p>
        </div>

        <div style={sectionStyle}>
          <p style={pStyle}>
            These Terms of Service ("Terms") govern your access to and use of
            Meridian (the "Service"), operated by Banton Digital ("we," "us," or
            "our"), located in West Orange, NJ, USA. By creating an account or
            using the Service, you agree to be bound by these Terms. If you do
            not agree, do not use the Service.
          </p>
        </div>

        {/* 1 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>1. Description of Service</h2>
          <p style={pStyle}>
            Meridian is a creator analytics and content repurposing platform
            that connects to your social media and newsletter accounts (YouTube,
            Instagram, TikTok, Twitter/X, LinkedIn, Beehiiv) to aggregate
            performance data, generate AI-powered content derivatives, and
            surface publishing insights.
          </p>
        </div>

        {/* 2 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>2. Eligibility</h2>
          <p style={pStyle}>
            You must be at least 13 years of age to use the Service. By using
            Meridian, you represent that you meet this requirement and that all
            information you provide is accurate.
          </p>
        </div>

        {/* 3 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>3. Accounts</h2>
          <p style={pStyle}>
            You sign in to Meridian using your Google account via OAuth. You are
            responsible for maintaining the security of your account and for all
            activities that occur under it. Notify us immediately at{" "}
            <a href="mailto:paul@banton-digital.com" style={linkStyle}>
              paul@banton-digital.com
            </a>{" "}
            if you suspect unauthorized access.
          </p>
        </div>

        {/* 4 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>4. Subscriptions and Billing</h2>
          <p style={pStyle}>
            Meridian offers free and paid subscription tiers. Paid plans are
            billed on a recurring basis through Stripe. By subscribing to a paid
            plan, you authorize us to charge your payment method on a recurring
            basis until you cancel.
          </p>
          <ul style={ulStyle}>
            <li style={liStyle}>
              Subscriptions renew automatically unless cancelled before the
              renewal date.
            </li>
            <li style={liStyle}>
              Refunds are handled at our discretion. Contact us at{" "}
              <a href="mailto:paul@banton-digital.com" style={linkStyle}>
                paul@banton-digital.com
              </a>{" "}
              within 7 days of a charge if you believe it was made in error.
            </li>
            <li style={liStyle}>
              Downgrading your plan takes effect at the start of the next
              billing cycle.
            </li>
            <li style={liStyle}>
              We reserve the right to change pricing with at least 30 days'
              notice to active subscribers.
            </li>
          </ul>
        </div>

        {/* 5 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>5. Acceptable Use</h2>
          <p style={pStyle}>You agree not to:</p>
          <ul style={ulStyle}>
            <li style={liStyle}>
              Use the Service to violate any applicable law or third-party
              rights.
            </li>
            <li style={liStyle}>
              Attempt to gain unauthorized access to any part of the Service or
              its underlying systems.
            </li>
            <li style={liStyle}>
              Use the Service to transmit spam, malware, or other harmful
              content.
            </li>
            <li style={liStyle}>
              Circumvent any usage limits or subscription restrictions.
            </li>
            <li style={liStyle}>
              Scrape or harvest data from the Service in an automated manner
              without our written consent.
            </li>
          </ul>
          <p style={pStyle}>
            We reserve the right to suspend or terminate your account for
            violations of this section.
          </p>
        </div>

        {/* 6 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>6. Connected Third-Party Platforms</h2>
          <p style={pStyle}>
            Meridian connects to third-party platforms on your behalf using
            OAuth or API credentials you provide. By connecting a platform, you
            authorize us to access data from that platform as permitted by their
            APIs. Your use of those platforms remains subject to their own terms
            of service.
          </p>
          <p style={pStyle}>
            We are not responsible for any actions taken by third-party
            platforms, including changes to their APIs, rate limits, or
            data-access policies that may affect the Service.
          </p>
        </div>

        {/* 7 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>7. Intellectual Property</h2>
          <p style={pStyle}>
            The Service and its original content, features, and functionality
            are owned by Banton Digital and are protected by applicable
            intellectual property laws.
          </p>
          <p style={pStyle}>
            You retain ownership of all content you create or import. By using
            the AI repurposing features, you grant us a limited, non-exclusive
            license to process that content solely to provide the Service to
            you.
          </p>
          <p style={pStyle}>
            AI-generated derivatives produced by the Service are provided for
            your use. We make no claim of ownership over them, and you are
            responsible for reviewing them before publishing.
          </p>
        </div>

        {/* 8 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>8. Privacy</h2>
          <p style={pStyle}>
            Your use of the Service is also governed by our{" "}
            <Link href="/privacy" style={linkStyle}>
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference.
          </p>
        </div>

        {/* 9 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>9. Disclaimers</h2>
          <p style={pStyle}>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
            LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
            WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT AI-GENERATED CONTENT
            WILL BE ACCURATE OR SUITABLE FOR PUBLISHING.
          </p>
        </div>

        {/* 10 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>10. Limitation of Liability</h2>
          <p style={pStyle}>
            TO THE FULLEST EXTENT PERMITTED BY LAW, BANTON DIGITAL SHALL NOT
            BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR DATA, ARISING OUT OF
            YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE
            POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ANY
            CLAIMS ARISING FROM THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU
            PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
          </p>
        </div>

        {/* 11 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>11. Termination</h2>
          <p style={pStyle}>
            You may stop using the Service at any time. We may suspend or
            terminate your access at our discretion, including for violations of
            these Terms, with or without notice. Upon termination, your right to
            use the Service ceases immediately. Provisions that by their nature
            should survive termination (including Sections 7, 9, 10, and 13)
            will do so.
          </p>
        </div>

        {/* 12 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>12. Changes to These Terms</h2>
          <p style={pStyle}>
            We may update these Terms from time to time. When we do, we will
            update the effective date at the top of this page. For material
            changes, we will make reasonable efforts to notify you (for example,
            via email). Your continued use of the Service after changes take
            effect constitutes acceptance of the revised Terms.
          </p>
        </div>

        {/* 13 */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>13. Governing Law</h2>
          <p style={pStyle}>
            These Terms are governed by the laws of the State of New Jersey,
            USA, without regard to its conflict-of-law provisions.
          </p>
        </div>

        {/* 14 */}
        <div style={{ ...sectionStyle, marginBottom: 0 }}>
          <h2 style={h2Style}>14. Contact</h2>
          <p style={pStyle}>
            Questions about these Terms? Contact us at:
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
        </div>
      </div>
    </main>
  );
}
