import { NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/user";
import { getTodayQueue } from "@/server/db/jobs";
import { jsonError, requireSupabase } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const data = await getTodayQueue(DEFAULT_USER_ID);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load queue", 500);
  }
}
