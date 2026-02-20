import type { UserEntitlement } from "./billing/types";
import { getUserEntitlement, hasActiveAccessForEntitlement, markTrialExpiredIfNeeded } from "./entitlements";
import { syncProfileAndEntitlementForUser } from "./profileSync";
import { createSupabaseServerClient } from "./supabase/server";

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

  await syncProfileAndEntitlementForUser(user);
  const entitlement = await getUserEntitlement(user.id);
  const normalized = entitlement ? await markTrialExpiredIfNeeded(entitlement) : null;
  const active = hasActiveAccessForEntitlement(normalized);

  return {
    userId: user.id,
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    entitlement: normalized,
    hasActiveAccess: active,
    isAuthenticated: true,
  };
}
