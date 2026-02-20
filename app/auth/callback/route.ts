import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { syncProfileAndEntitlementForUser } from "../../lib/profileSync";
import { hasActiveAccess } from "../../lib/entitlements";
import { logServerError } from "../../lib/supabase/errors";
import { getDomainFromEmailOrDomain, isVcomEligibleEmailOrDomain } from "../../lib/vcom";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/app";

  if (!code) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logServerError("auth callback session exchange failed", error);
      return NextResponse.redirect(new URL("/?authError=1", request.url));
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const email = user.email ?? null;
    const domain = getDomainFromEmailOrDomain(email);
    const vcomEligible = isVcomEligibleEmailOrDomain(email);

    let entitlementActive = false;
    try {
      await syncProfileAndEntitlementForUser(user);
      entitlementActive = await hasActiveAccess(user.id);
    } catch (syncError) {
      logServerError("auth callback sync failure", syncError);
      entitlementActive = false;
    }

    const active = vcomEligible || entitlementActive;
    if (process.env.NODE_ENV !== "production") {
      console.log("[auth-callback] gating", {
        email,
        domain,
        vcomEligible,
        destination: active ? next : "/pricing",
      });
    }

    return NextResponse.redirect(new URL(active ? next : "/pricing", request.url));
  } catch (error) {
    logServerError("auth callback failure", error);
    return NextResponse.redirect(new URL("/?authError=1", request.url));
  }
}
