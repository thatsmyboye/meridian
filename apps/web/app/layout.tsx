import type { Metadata } from "next";
import { Suspense } from "react";
import AppHeader from "./components/AppHeader";
import { PostHogIdentifier } from "./components/PostHogIdentifier";
import { PostHogPageView } from "./components/PostHogPageView";
import { PostHogProvider } from "./providers";
import { createServerClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meridian",
  description: "Know what works. Ship it everywhere.",
  icons: {
    icon: "/Meridian.jpg",
    shortcut: "/Meridian.jpg",
    apple: "/Meridian.jpg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userDisplay =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    null;

  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-QHS55ZE82D"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-QHS55ZE82D');
            `,
          }}
        />
      </head>
      <body>
        <PostHogProvider>
          {/* Fires $pageview on every client-side navigation */}
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          {/* Links Supabase auth user to PostHog profile */}
          <PostHogIdentifier />
          <AppHeader isLoggedIn={!!user} userDisplay={userDisplay} />
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
