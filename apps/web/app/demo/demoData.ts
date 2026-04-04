// ─── Demo Sample Data ─────────────────────────────────────────────────────────
// Realistic sample data for the Google OAuth verification demo flow.
// No real user data — all names, metrics, and content are fictional.

export const DEMO_CREATOR = {
  name: "Alex Rivera",
  email: "alex@example.com",
  avatar: "AR",
  tier: "creator" as const,
  platformCount: 2,
  platformLimit: 3,
};

// ─── Sample YouTube videos ─────────────────────────────────────────────────

export interface DemoContentItem {
  contentId: string;
  title: string;
  platform: string;
  publishedAt: string;
  totalViews: number;
  engagementRate: number;
  watchTimeMinutes: number | null;
  durationSeconds: number | null;
  description?: string;
}

// Published over the past year so the heatmap and period filters all have data
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

export const DEMO_CONTENT: DemoContentItem[] = [
  // YouTube videos
  {
    contentId: "yt-001",
    title: "Building a Full-Stack App with Next.js 15 & Supabase",
    platform: "youtube",
    publishedAt: daysAgo(8),
    totalViews: 84_200,
    engagementRate: 6.8,
    watchTimeMinutes: 41_300,
    durationSeconds: 2_340,
    description:
      "A step-by-step walkthrough of building a production-ready SaaS from scratch using Next.js 15 App Router, Supabase for auth and database, and Tailwind CSS for styling.",
  },
  {
    contentId: "yt-002",
    title: "My AI-Assisted Coding Workflow in 2025",
    platform: "youtube",
    publishedAt: daysAgo(22),
    totalViews: 127_400,
    engagementRate: 7.4,
    watchTimeMinutes: 58_900,
    durationSeconds: 1_820,
    description:
      "How I use Claude, Cursor, and custom prompts to ship features 3× faster without sacrificing code quality.",
  },
  {
    contentId: "yt-003",
    title: "10× Developer Productivity Tips (That Actually Work)",
    platform: "youtube",
    publishedAt: daysAgo(36),
    totalViews: 213_600,
    engagementRate: 8.1,
    watchTimeMinutes: 102_400,
    durationSeconds: 2_100,
    description:
      "Practical, battle-tested tips from building 5 SaaS products — covering tooling, time management, and deep-work habits.",
  },
  {
    contentId: "yt-004",
    title: "TypeScript Generics Explained (No More Confusion)",
    platform: "youtube",
    publishedAt: daysAgo(50),
    totalViews: 96_700,
    engagementRate: 5.9,
    watchTimeMinutes: 47_200,
    durationSeconds: 1_440,
    description: "Finally demystifying TypeScript generics with real-world examples.",
  },
  {
    contentId: "yt-005",
    title: "I Built a SaaS in 48 Hours — Here's What I Learned",
    platform: "youtube",
    publishedAt: daysAgo(65),
    totalViews: 341_000,
    engagementRate: 9.2,
    watchTimeMinutes: 164_000,
    durationSeconds: 2_760,
    description:
      "A 48-hour hackathon experiment that became a real product. Honest post-mortem on what worked and what didn't.",
  },
  {
    contentId: "yt-006",
    title: "React Server Components Are a Game Changer",
    platform: "youtube",
    publishedAt: daysAgo(80),
    totalViews: 158_300,
    engagementRate: 6.5,
    watchTimeMinutes: 75_600,
    durationSeconds: 1_680,
    description: "Why RSCs change how we think about data fetching in Next.js.",
  },
  {
    contentId: "yt-007",
    title: "Stop Writing Bad Database Queries (PostgreSQL Best Practices)",
    platform: "youtube",
    publishedAt: daysAgo(95),
    totalViews: 74_500,
    engagementRate: 5.2,
    watchTimeMinutes: 34_100,
    durationSeconds: 1_320,
    description:
      "Index strategies, query planning, and common pitfalls when working with PostgreSQL.",
  },
  {
    contentId: "yt-008",
    title: "Build a Real-Time Chat App with Supabase Realtime",
    platform: "youtube",
    publishedAt: daysAgo(110),
    totalViews: 89_100,
    engagementRate: 6.1,
    watchTimeMinutes: 41_800,
    durationSeconds: 1_980,
    description: "End-to-end guide to building a Slack-like chat UI with Supabase.",
  },
  {
    contentId: "yt-009",
    title: "Deploy Next.js to the Edge in Under 5 Minutes",
    platform: "youtube",
    publishedAt: daysAgo(125),
    totalViews: 52_300,
    engagementRate: 4.8,
    watchTimeMinutes: 22_900,
    durationSeconds: 720,
    description: "Fastest deployment guide for Vercel Edge Functions with Next.js.",
  },
  {
    contentId: "yt-010",
    title: "Authentication Deep Dive: OAuth 2.0, JWTs & Supabase Auth",
    platform: "youtube",
    publishedAt: daysAgo(142),
    totalViews: 118_500,
    engagementRate: 7.0,
    watchTimeMinutes: 54_200,
    durationSeconds: 2_520,
    description:
      "A comprehensive look at modern auth patterns — PKCE flows, JWT refresh, and session management.",
  },
  // Instagram posts derived from YouTube videos
  {
    contentId: "ig-001",
    title: "Next.js + Supabase SaaS setup (carousel)",
    platform: "instagram",
    publishedAt: daysAgo(7),
    totalViews: 14_200,
    engagementRate: 4.1,
    watchTimeMinutes: null,
    durationSeconds: null,
  },
  {
    contentId: "ig-002",
    title: "AI coding workflow breakdown",
    platform: "instagram",
    publishedAt: daysAgo(21),
    totalViews: 22_800,
    engagementRate: 5.3,
    watchTimeMinutes: null,
    durationSeconds: null,
  },
  {
    contentId: "ig-003",
    title: "48-hour SaaS lessons (slide deck)",
    platform: "instagram",
    publishedAt: daysAgo(64),
    totalViews: 31_400,
    engagementRate: 6.7,
    watchTimeMinutes: null,
    durationSeconds: null,
  },
  {
    contentId: "ig-004",
    title: "TypeScript tip of the week",
    platform: "instagram",
    publishedAt: daysAgo(49),
    totalViews: 8_900,
    engagementRate: 3.8,
    watchTimeMinutes: null,
    durationSeconds: null,
  },
];

// ─── Performance snapshots per content item ───────────────────────────────

export interface DemoSnapshot {
  contentId: string;
  dayMark: 1 | 7 | 30;
  views: number;
  engagementRate: number;
}

export const DEMO_SNAPSHOTS: DemoSnapshot[] = [
  // yt-001
  { contentId: "yt-001", dayMark: 1, views: 18_400, engagementRate: 7.2 },
  { contentId: "yt-001", dayMark: 7, views: 61_300, engagementRate: 6.9 },
  { contentId: "yt-001", dayMark: 30, views: 84_200, engagementRate: 6.8 },
  // yt-002
  { contentId: "yt-002", dayMark: 1, views: 22_100, engagementRate: 7.8 },
  { contentId: "yt-002", dayMark: 7, views: 94_600, engagementRate: 7.5 },
  { contentId: "yt-002", dayMark: 30, views: 127_400, engagementRate: 7.4 },
  // yt-003
  { contentId: "yt-003", dayMark: 1, views: 41_000, engagementRate: 8.6 },
  { contentId: "yt-003", dayMark: 7, views: 168_000, engagementRate: 8.3 },
  { contentId: "yt-003", dayMark: 30, views: 213_600, engagementRate: 8.1 },
  // yt-005
  { contentId: "yt-005", dayMark: 1, views: 72_000, engagementRate: 9.8 },
  { contentId: "yt-005", dayMark: 7, views: 264_000, engagementRate: 9.4 },
  { contentId: "yt-005", dayMark: 30, views: 341_000, engagementRate: 9.2 },
  // ig-001
  { contentId: "ig-001", dayMark: 1, views: 3_200, engagementRate: 4.5 },
  { contentId: "ig-001", dayMark: 7, views: 11_000, engagementRate: 4.2 },
  { contentId: "ig-001", dayMark: 30, views: 14_200, engagementRate: 4.1 },
];

// ─── Pattern insights ──────────────────────────────────────────────────────

export interface DemoInsight {
  id: string;
  insight_type: string;
  summary: string;
  narrative: string;
  confidence_label: "Strong" | "Moderate" | "Emerging";
  confidence: number;
  generated_at: string;
  dismissed_at: null;
  evidence_json: Record<string, unknown>;
  supporting_content: {
    contentId: string;
    title: string;
    platform: string;
    publishedAt: string;
    engagementRate: number;
    totalViews: number;
  }[];
}

export const DEMO_INSIGHTS: DemoInsight[] = [
  {
    id: "ins-001",
    insight_type: "day_of_week",
    summary: "Publishing on Wednesday drives 2.3× more views in the first 7 days",
    narrative:
      "Your Wednesday uploads consistently outperform other days. The algorithm appears to favor mid-week slots for tech content targeting working professionals.",
    confidence_label: "Strong",
    confidence: 0.87,
    generated_at: daysAgo(2),
    dismissed_at: null,
    evidence_json: { best_day: { day: 3, label: "Wednesday" }, total_posts_analysed: 10 },
    supporting_content: [
      {
        contentId: "yt-003",
        title: "10× Developer Productivity Tips (That Actually Work)",
        platform: "youtube",
        publishedAt: daysAgo(36),
        engagementRate: 8.1,
        totalViews: 213_600,
      },
      {
        contentId: "yt-005",
        title: "I Built a SaaS in 48 Hours — Here's What I Learned",
        platform: "youtube",
        publishedAt: daysAgo(65),
        engagementRate: 9.2,
        totalViews: 341_000,
      },
      {
        contentId: "yt-002",
        title: "My AI-Assisted Coding Workflow in 2025",
        platform: "youtube",
        publishedAt: daysAgo(22),
        engagementRate: 7.4,
        totalViews: 127_400,
      },
    ],
  },
  {
    id: "ins-002",
    insight_type: "length_bucket",
    summary: "Videos between 25–40 minutes earn 41% higher engagement than short-form",
    narrative:
      "Your audience skews toward deep-dive content. Long-form tutorials see longer average watch times and significantly more comments per view than videos under 15 minutes.",
    confidence_label: "Strong",
    confidence: 0.81,
    generated_at: daysAgo(2),
    dismissed_at: null,
    evidence_json: { best_bucket: "long", total_posts_analysed: 10 },
    supporting_content: [
      {
        contentId: "yt-001",
        title: "Building a Full-Stack App with Next.js 15 & Supabase",
        platform: "youtube",
        publishedAt: daysAgo(8),
        engagementRate: 6.8,
        totalViews: 84_200,
      },
      {
        contentId: "yt-010",
        title: "Authentication Deep Dive: OAuth 2.0, JWTs & Supabase Auth",
        platform: "youtube",
        publishedAt: daysAgo(142),
        engagementRate: 7.0,
        totalViews: 118_500,
      },
    ],
  },
  {
    id: "ins-003",
    insight_type: "posting_frequency",
    summary: "Weeks with 2 uploads average 67% more total views than single-upload weeks",
    narrative:
      "When you publish twice a week — usually pairing a long tutorial with a short tip — overall channel views increase substantially. Consistency compounds.",
    confidence_label: "Moderate",
    confidence: 0.68,
    generated_at: daysAgo(2),
    dismissed_at: null,
    evidence_json: { median_posts_per_week: 1, weeks_analysed: 20 },
    supporting_content: [
      {
        contentId: "yt-003",
        title: "10× Developer Productivity Tips (That Actually Work)",
        platform: "youtube",
        publishedAt: daysAgo(36),
        engagementRate: 8.1,
        totalViews: 213_600,
      },
      {
        contentId: "ig-003",
        title: "48-hour SaaS lessons (slide deck)",
        platform: "instagram",
        publishedAt: daysAgo(64),
        engagementRate: 6.7,
        totalViews: 31_400,
      },
    ],
  },
  {
    id: "ins-004",
    insight_type: "content_type",
    summary: "Tutorial-format content earns 3.1× more watch time than commentary videos",
    narrative:
      "Step-by-step tutorials where viewers follow along generate significantly longer watch sessions. Consider pairing every commentary piece with a hands-on follow-up.",
    confidence_label: "Emerging",
    confidence: 0.54,
    generated_at: daysAgo(2),
    dismissed_at: null,
    evidence_json: { best_type: "youtube", total_posts_analysed: 10 },
    supporting_content: [
      {
        contentId: "yt-002",
        title: "My AI-Assisted Coding Workflow in 2025",
        platform: "youtube",
        publishedAt: daysAgo(22),
        engagementRate: 7.4,
        totalViews: 127_400,
      },
    ],
  },
];

// ─── Sample derivatives for repurpose demo ────────────────────────────────

export interface DemoDerivative {
  format: string;
  label: string;
  platform: string;
  content: string;
  charCount: number;
  status: "approved" | "pending";
}

export const DEMO_DERIVATIVES: DemoDerivative[] = [
  {
    format: "linkedin_post",
    label: "LinkedIn Post",
    platform: "linkedin",
    charCount: 820,
    status: "pending",
    content: `I built a SaaS in 48 hours. Here's what the data actually showed.

Friday 8pm to Sunday 8pm. One rule: ship something with paying customers or it didn't count.

Stack: Next.js 15 + Supabase + Stripe + Vercel. Nothing exotic. The constraint was the clock.

Three things that worked:
→ Supabase RLS eliminated the entire auth layer boilerplate
→ Server Actions removed the need for a separate API
→ Vercel previews gave instant mobile QA feedback

Three things that almost derailed it:
→ No rate limiting on the AI endpoint — lost $40 in 30 minutes to bots
→ Designing desktop-first when most signups came from mobile
→ Forgetting the Stripe CLI webhook listener until day two

End result: 7 paying customers, $280 MRR, and a product roadmap I'd never have written without the forcing function.

The 48-hour limit didn't constrain the product. It clarified it.

Full architecture breakdown + post-mortem in the YouTube video (link in comments).

#buildinpublic #saas #startups #webdevelopment #softwaredevelopment`,
  },
  {
    format: "instagram_caption",
    label: "Instagram Caption",
    platform: "instagram",
    charCount: 640,
    status: "pending",
    content: `Built a SaaS in 48 hours 🚀 Here's the honest breakdown.

Stack: Next.js + Supabase + Stripe + Vercel.
Timeline: Friday 8pm → Sunday 8pm.
Result: 7 paying customers, $280 MRR.

The three things that saved me:
✅ Supabase RLS — zero back-end auth boilerplate
✅ Server Actions — no separate API layer
✅ Vercel previews — instant mobile QA loop

The three things that almost killed me:
❌ No rate limiting on the AI endpoint (lost $40 in 30 mins)
❌ Designing desktop-first
❌ Forgetting the Stripe CLI until day 2

The biggest unlock? The 48-hour limit forced ruthless scoping. I shipped features I'd normally bikeshed on for days.

Constraints = clarity.

Full 30-min deep dive on YouTube (link in bio) 🎥

#buildinpublic #saas #nextjs #indiehacker #webdevelopment #coding #programming`,
  },
  {
    format: "tiktok_script",
    label: "TikTok Script",
    platform: "tiktok",
    charCount: 480,
    status: "pending",
    content: `[Hook — 0:00–0:03]
I built a SaaS in 48 hours. Seven paying customers by Sunday night.

[Problem — 0:03–0:10]
Most developers spend months planning before they ship. I wanted to find out what happens when you remove that option entirely.

[Story — 0:10–0:40]
Friday 8pm: idea locked. Next.js, Supabase, Stripe. No overthinking the stack.
Saturday morning: auth and payments working. The forced timeline made every decision obvious.
Sunday afternoon: launched. First paying customer within two hours.

[Lesson — 0:40–0:55]
The 48-hour constraint didn't limit the product — it clarified it. Every feature I "didn't have time for" was probably a feature nobody needed.

[CTA — 0:55–1:00]
Full breakdown on YouTube. Link in bio. Would you try this?`,
  },
  {
    format: "newsletter_blurb",
    label: "Newsletter Blurb",
    platform: "newsletter",
    charCount: 740,
    status: "pending",
    content: `**This week I built a SaaS in 48 hours — here's what I found out**

I set a rule: idea to live product with paying customers in one weekend. No extensions.

The stack was straightforward — Next.js 15, Supabase, Stripe, Vercel. Nothing exotic. The challenge was the clock.

A few things surprised me:

**The speed gains are real.** Supabase's Row-Level Security eliminated an entire auth layer. Next.js Server Actions cut out the API. I was deploying to production Saturday morning with a working auth and payment flow.

**The mistakes were expensive.** I didn't rate-limit the AI endpoint. Thirty minutes after launch, I'd burned $40 on OpenAI calls from bots. Add that to your pre-launch checklist.

**Constraints are underrated.** Every feature I "didn't have time for" was probably a feature I didn't need. The forcing function made me ship a focused product instead of an ambitious prototype.

End result: 7 paying customers, $280 MRR, and a clearer product roadmap than I'd have gotten from weeks of planning.

Full code walkthrough (30 min) is on YouTube. I cover the architecture decisions, the mistakes, and whether I'd do it again. Spoiler: yes.

[Watch the full video →]`,
  },
];

// ─── OAuth scope descriptions shown during YouTube connect ────────────────

export const YOUTUBE_SCOPES = [
  {
    scope: "youtube.readonly",
    label: "View your YouTube account",
    detail:
      "Read your channel name, video titles, descriptions, thumbnails, tags, and publish dates.",
  },
  {
    scope: "yt-analytics.readonly",
    label: "View YouTube Analytics reports",
    detail:
      "Read view counts, watch time, impressions, click-through rates, and engagement metrics for your videos.",
  },
];
