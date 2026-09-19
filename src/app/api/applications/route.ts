import { NextResponse } from "next/server";
import { APPLICATION_STATUSES } from "@/lib/types";
import { DEFAULT_USER_ID } from "@/lib/user";
import { listApplications, updateApplication } from "@/server/db/jobs";
import { jsonError, requireSupabase } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const applications = await listApplications(DEFAULT_USER_ID);
    return NextResponse.json({ applications });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load tracker", 500);
  }
}

export async function PATCH(request: Request) {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as {
      applicationId?: string;
      status?: string;
      notes?: string;
    };
    if (!body.applicationId) return jsonError("applicationId is required");
    if (
      body.status &&
      !APPLICATION_STATUSES.includes(body.status as (typeof APPLICATION_STATUSES)[number])
    ) {
      return jsonError("Invalid status");
    }
    const updated = await updateApplication(DEFAULT_USER_ID, body.applicationId, {
      status: body.status as (typeof APPLICATION_STATUSES)[number] | undefined,
      notes: body.notes,
    });
    return NextResponse.json({ application: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update application", 500);
  }
}
