import { NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/user";
import {
  enqueueJobToToday,
  getTodayQueue,
  listCrawlerInbox,
} from "@/server/db/jobs";
import { describeFailure, jsonError, requireSupabase } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const [data, crawlerJobs] = await Promise.all([
      getTodayQueue(DEFAULT_USER_ID),
      listCrawlerInbox(DEFAULT_USER_ID),
    ]);
    return NextResponse.json({ ...data, crawlerJobs });
  } catch (error) {
    return jsonError(describeFailure(error, "Failed to load queue"), 500);
  }
}

export async function POST(request: Request) {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as { jobId?: string };
    if (!body.jobId?.trim()) return jsonError("jobId is required");
    const result = await enqueueJobToToday(DEFAULT_USER_ID, body.jobId.trim());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(describeFailure(error, "Failed to add job to today's queue"), 500);
  }
}
