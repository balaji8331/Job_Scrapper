import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  return NextResponse.json({
    ok: true,
    supabase: isSupabaseConfigured(),
    adzuna: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    jsearch: Boolean(process.env.RAPIDAPI_KEY),
  });
}
