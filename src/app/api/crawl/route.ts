import { NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/user";
import {
  crawlCompanySlug,
  crawlConfiguredCompanies,
  crawlPendingBatch,
} from "@/server/crawler/run";
import { listCrawlerInbox } from "@/server/db/jobs";
import { jsonError, requireSupabase } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const jobs = await listCrawlerInbox(DEFAULT_USER_ID);
    return NextResponse.json({ jobs, count: jobs.length });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to list crawler jobs", 500);
  }
}

export async function POST(request: Request) {
  const blocked = requireSupabase();
  if (blocked) return blocked;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      slug?: string;
      slugs?: string[];
      maxJobs?: number;
      role?: string;
      mode?: "all" | "pending" | "slugs";
      limit?: number;
      delayMs?: number;
    };
    const maxJobs = Math.min(Math.max(body.maxJobs ?? 15, 1), 40);

    if (body.slug?.trim()) {
      const result = await crawlCompanySlug(body.slug.trim(), {
        maxJobs,
        role: body.role,
      });
      return NextResponse.json({ ok: !result.error, result });
    }

    if (body.mode === "pending" || (!body.slugs?.length && body.mode !== "all")) {
      const results = await crawlPendingBatch({
        limit: body.limit ?? 20,
        maxJobs,
        delayMs: body.delayMs ?? 1500,
      });
      return NextResponse.json({
        ok: true,
        mode: "pending",
        count: results.length,
        results,
      });
    }

    const results = await crawlConfiguredCompanies(body.slugs, {
      maxJobs,
      delayMs: body.delayMs ?? 1500,
    });
    return NextResponse.json({
      ok: true,
      mode: body.slugs?.length ? "slugs" : "all",
      count: results.length,
      results,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Crawl failed", 500);
  }
}
