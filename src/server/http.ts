import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";

export function requireSupabase() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }
  return null;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function describeFailure(error: unknown, fallback: string): string {
  const record =
    error && typeof error === "object"
      ? (error as { message?: string; details?: string; hint?: string; code?: string })
      : undefined;
  const message = error instanceof Error ? error.message : record?.message;
  const combined = [message, record?.details, record?.hint].filter(Boolean).join("\n");
  const host = combined.match(/ENOTFOUND\s+(\S+)/)?.[1];
  if (host) {
    return `Could not reach ${host}. DNS lookup failed, so the search results cannot be saved.`;
  }
  return message || fallback;
}
