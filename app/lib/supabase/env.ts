function missingEnvError(name: string): Error {
  return new Error(`Missing required environment variable: ${name}. Add it to .env.local and restart the dev server.`);
}

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw missingEnvError("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!anonKey) {
    throw missingEnvError("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url, anonKey };
}

export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw missingEnvError(name);
  }
  return value;
}

export function getServerSupabaseEnv() {
  const { url, anonKey } = getPublicSupabaseEnv();
  const serviceRoleKey = requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
}
