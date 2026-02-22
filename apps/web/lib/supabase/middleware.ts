import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request so Server Components
 * always have access to a valid session cookie.
 *
 * Add this to your `middleware.ts`:
 *   export { updateSession as middleware } from "@/lib/supabase/middleware";
 *   export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not remove this await.
  // getClaims() reads JWT claims locally and only makes a network call when
  // the token actually needs refreshing, unlike getUser() which always
  // round-trips to Supabase auth servers.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
