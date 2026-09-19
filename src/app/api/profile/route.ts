import { NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/user";
import { jsonError, requireSupabase } from "@/server/http";
import { getProfile, upsertProfile } from "@/server/db/profile";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const profile = await getProfile(DEFAULT_USER_ID);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load profile", 500);
  }
}

export async function POST(request: Request) {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as Partial<Profile>;
    const profile = await upsertProfile({
      userId: DEFAULT_USER_ID,
      fullName: body.fullName ?? "",
      email: body.email ?? "",
      phone: body.phone ?? "",
      location: body.location ?? "",
      linkedinUrl: body.linkedinUrl ?? "",
      githubUrl: body.githubUrl ?? "",
      portfolioUrl: body.portfolioUrl ?? "",
      summary: body.summary ?? "",
      skills: body.skills ?? [],
      targetRoles: body.targetRoles ?? [],
      cities: body.cities ?? [],
      experience: body.experience ?? [],
      education: body.education ?? [],
      projects: body.projects ?? [],
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save profile", 500);
  }
}
