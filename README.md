# Meridian

Meridian is a content intelligence and repurposing platform for creators and agencies. It unifies analytics across YouTube, Instagram, and Beehiiv into a single dashboard, surfaces AI-powered insights about what content performs best, and automatically repurposes content into platform-specific formats using Claude.

## What it does

**Unified analytics** — Connect your YouTube, Instagram, and Beehiiv accounts. Meridian pulls performance metrics from each platform, normalizes them into a common format, and displays them together. See views, engagement rates, watch time, and publishing consistency across all your content in one place.

**Pattern insights** — Meridian runs weekly analysis on your content history using Claude to identify what's working: which days drive the most engagement, what content length performs best, which formats resonate with your audience. Insights are surfaced in the dashboard with supporting evidence from your actual content.

**Content repurposing** — Select any piece of content and Meridian generates platform-specific derivatives using Claude: Twitter/X threads, LinkedIn posts, TikTok scripts, newsletters, and more. Generated drafts are editable before publishing, and can be scheduled to go out at optimal times based on your performance data.

**Background sync** — Platform data stays current via background jobs (Inngest) that periodically sync content metadata, capture analytics snapshots at 1-, 7-, and 30-day intervals, and deliver weekly digest emails summarizing performance trends.

## Architecture

Meridian is a TypeScript monorepo built with Turborepo and pnpm.

```
meridian/
├── apps/
│   ├── web/          # Next.js 15 dashboard (main interface)
│   └── mobile/       # Expo React Native app (iOS/Android)
├── packages/
│   ├── types/        # Shared TypeScript type definitions
│   ├── api/          # Supabase client factories and token utilities
│   ├── ui/           # Shared React components (web + React Native)
│   └── inngest/      # Background job functions and event schemas
└── supabase/         # Local development configuration
```

**Web app** (`apps/web`) — Next.js 15 with the App Router. Handles authentication, the analytics dashboard, content repurposing UI, OAuth connection flows, and Stripe billing.

**Mobile app** (`apps/mobile`) — Expo with React Native. Provides the same core experience on iOS and Android via Expo Router.

**Background jobs** (`packages/inngest`) — Inngest functions handle all async work: platform syncs, analytics snapshots, Claude-powered pattern analysis, derivative generation, scheduled publishing, and email delivery via Resend.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Expo, NativeWind |
| Data | Supabase (PostgreSQL + Auth) |
| Background jobs | Inngest |
| AI | Anthropic Claude (content generation, pattern analysis) |
| Payments | Stripe |
| Email | Resend + React Email |
| Charts | Recharts |

## Platform integrations

- **YouTube** — OAuth + YouTube Analytics API for video metrics and transcripts
- **Instagram** — Meta OAuth + Instagram Graph API for post and reel performance
- **Beehiiv** — API key-based integration for newsletter analytics

## Subscription tiers

| Plan | Platforms | Repurpose jobs/month | Team members |
|---|---|---|---|
| Free | 1 | 5 | 1 |
| Creator | 3 | 20 | 3 |
| Pro | Unlimited | Unlimited | Unlimited |

## Getting started

See [AGENTS.md](./AGENTS.md) for local development setup, including how to run Supabase locally with Docker, configure environment variables, and start the development servers.

## Environment variables

Copy `.env.example` to set up your environment. Required variables include:

- Supabase project URL and keys
- OAuth credentials for YouTube (Google), Instagram (Meta)
- Beehiiv API configuration
- Anthropic API key (for Claude)
- Stripe keys and webhook secret
- Resend API key
- Inngest signing and event keys
