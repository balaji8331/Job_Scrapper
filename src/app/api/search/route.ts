import { NextResponse } from "next/server";
import { EXPERIENCE_LEVELS } from "@/lib/types";
import { DEFAULT_USER_ID } from "@/lib/user";
import { runSearchAndQueue } from "@/server/applications/queue";
import { getProfile } from "@/server/db/profile";
import { jsonError, requireSupabase } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const blocked = requireSupabase();
  if (blocked) return blocked;

  try {
    const body = (await request.json()) as {
      role?: string;
      level?: string;
      location?: string;
      remoteOk?: boolean;
      cities?: string[];
    };
    const role = body.role?.trim();
    const level = EXPERIENCE_LEVELS.includes(body.level as (typeof EXPERIENCE_LEVELS)[number])
      ? (body.level as (typeof EXPERIENCE_LEVELS)[number])
      : null;
    if (!role) return jsonError("Role is required");
    if (!level) return jsonError("Level is required");

    const profile = await getProfile(DEFAULT_USER_ID);
    const result = await runSearchAndQueue({
      userId: DEFAULT_USER_ID,
      role,
      level,
      location: body.location?.trim() || undefined,
      remoteOk: body.remoteOk !== false,
      cities: body.cities,
      profile,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Search failed", 500);
  }
}
