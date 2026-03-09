"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

/**
 * Identifies the currently logged-in Supabase user with PostHog so all
 * subsequent events are linked to that user's profile.
 *
 * Calls `posthog.reset()` on sign-out so events are no longer attributed
 * to the previous user's profile.
 */
export function PostHogIdentifier() {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;

    const supabase = createBrowserClient();

    // Identify on mount
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        posthog.identify(data.user.id, {
          email: data.user.email,
        });
      }
    });

    // Keep in sync with auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        posthog.identify(session.user.id, {
          email: session.user.email,
        });
      } else if (event === "SIGNED_OUT") {
        posthog.reset();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [posthog]);

  return null;
}
