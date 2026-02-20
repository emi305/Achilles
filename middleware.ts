import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasActiveAccess } from "./app/lib/entitlements";
import { syncProfileAndEntitlementForUser } from "./app/lib/profileSync";
import { logServerError } from "./app/lib/supabase/errors";
import { getPublicSupabaseEnv } from "./app/lib/supabase/env";
import { getDomainFromEmailOrDomain, isVcomEligibleEmailOrDomain } from "./app/lib/vcom";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { url, anonKey } = getPublicSupabaseEnv();

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

  const email = user.email ?? null;
  const domain = getDomainFromEmailOrDomain(email);
  const vcomEligible = isVcomEligibleEmailOrDomain(email);

  let entitlementActive = false;
  try {
    await syncProfileAndEntitlementForUser(user);
    entitlementActive = await hasActiveAccess(user.id);
  } catch (error) {
    logServerError("middleware sync failure", error);
    entitlementActive = false;
  }

  const active = vcomEligible || entitlementActive;
  if (process.env.NODE_ENV !== "production") {
    console.log("[middleware] gating", {
      email,
      domain,
      vcomEligible,
      destination: active ? request.nextUrl.pathname : "/pricing",
    });
  }

  if (!active) {
    const redirectUrl = new URL("/pricing", request.url);
    redirectUrl.searchParams.set("access", "required");
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/upload/:path*", "/results/:path*", "/review/:path*", "/settings/:path*"],
};
