import type { UserEntitlement } from "./billing/types";
import { getUserEntitlement, hasActiveAccessForEntitlement, markTrialExpiredIfNeeded } from "./entitlements";
import { syncProfileAndEntitlementForUser } from "./profileSync";
import { logServerError } from "./supabase/errors";
import { createSupabaseServerClient } from "./supabase/server";
import { getDomainFromEmailOrDomain, isVcomEligibleEmailOrDomain } from "./vcom";

export type ViewerContext = {
  userId: string | null;
  email: string | null;
  emailVerified: boolean;
  entitlement: UserEntitlement | null;
  hasActiveAccess: boolean;
  isAuthenticated: boolean;
};

export async function getViewerContext(): Promise<ViewerContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      email: null,
      emailVerified: false,
      entitlement: null,
      hasActiveAccess: false,
      isAuthenticated: false,
    };
  }

  try {
    const email = user.email ?? null;
    const domain = getDomainFromEmailOrDomain(email);
    const vcomEligible = isVcomEligibleEmailOrDomain(email);

    await syncProfileAndEntitlementForUser(user);
    const entitlement = await getUserEntitlement(user.id);
    const normalized = entitlement ? await markTrialExpiredIfNeeded(entitlement) : null;
    const entitlementActive = hasActiveAccessForEntitlement(normalized);
    const active = vcomEligible || entitlementActive;
    if (process.env.NODE_ENV !== "production") {
      console.log("[viewer-context] gating", {
        email,
        domain,
        vcomEligible,
        destination: active ? "/app" : "/pricing",
      });
    }

    return {
      userId: user.id,
      email,
      emailVerified: Boolean(user.email_confirmed_at),
      entitlement: normalized,
      hasActiveAccess: active,
      isAuthenticated: true,
    };
  } catch (error) {
    logServerError("getViewerContext sync failure", error);
    const email = user.email ?? null;
    const domain = getDomainFromEmailOrDomain(email);
    const vcomEligible = isVcomEligibleEmailOrDomain(email);
    if (process.env.NODE_ENV !== "production") {
      console.log("[viewer-context] gating", {
        email,
        domain,
        vcomEligible,
        destination: vcomEligible ? "/app" : "/pricing",
      });
    }
    return {
      userId: user.id,
      email,
      emailVerified: Boolean(user.email_confirmed_at),
      entitlement: null,
      hasActiveAccess: vcomEligible,
      isAuthenticated: true,
    };
  }
}
