"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getBaseSupabaseEnv } from "./env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getBaseSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
