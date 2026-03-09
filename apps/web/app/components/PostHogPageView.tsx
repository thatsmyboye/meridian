"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

/**
 * Fires a PostHog `$pageview` event on every client-side navigation.
 *
 * Must be rendered inside a <Suspense> boundary because it uses
 * `useSearchParams()`, which suspends in Next.js App Router.
 */
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!pathname || !posthog) return;

    let url = window.location.origin + pathname;
    const params = searchParams.toString();
    if (params) url += `?${params}`;

    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}
