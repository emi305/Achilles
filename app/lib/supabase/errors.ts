type SupabaseLikeError = {
  code?: string;
  details?: string;
  message?: string;
};

export function isNoRowSupabaseError(error: unknown): boolean {
  const supabaseError = error as SupabaseLikeError | null;
  if (!supabaseError) {
    return false;
  }
  if (supabaseError.code === "PGRST116") {
    return true;
  }
  const details = supabaseError.details ?? "";
  const message = supabaseError.message ?? "";
  return details.includes("0 rows") || message.includes("0 rows");
}

export function logServerError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${context}]`, error);
  }
}
