import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasActiveAccess } from "./app/lib/entitlements";
import { syncProfileAndEntitlementForUser } from "./app/lib/profileSync";
import { getBaseSupabaseEnv } from "./app/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { url, anonKey } = getBaseSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("auth", "required");
    return NextResponse.redirect(redirectUrl);
  }

  await syncProfileAndEntitlementForUser(user);
  const active = await hasActiveAccess(user.id);
  if (!active) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("access", "required");
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/upload/:path*", "/results/:path*", "/review/:path*", "/settings/:path*"],
};
