import { createClient } from "@supabase/supabase-js";
import { getBaseSupabaseEnv, requireEnv } from "./env";

let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const { url } = getBaseSupabaseEnv();
  const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  adminClient = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
