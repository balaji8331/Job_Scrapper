import { NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/user";
import { importJob, rebuildTodayQueue } from "@/server/db/jobs";
import { jsonError, requireSupabase } from "@/server/http";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as {
      url?: string;
      title?: string;
      company?: string;
      location?: string;
      description?: string;
    };
    const url = body.url?.trim();
    if (!url) return jsonError("url is required");

    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "import";
      }
    })();

    const jobId = await importJob({
      source: "import",
      externalId: url,
      title: body.title?.trim() || `Imported role from ${host}`,
      company: body.company?.trim() || host,
      location: body.location?.trim() || "India",
      applyUrl: url,
      description: body.description?.trim() || "",
      salary: null,
      postedAt: new Date().toISOString(),
      remote: /remote/i.test(`${body.location} ${body.title}`),
      tags: ["imported"],
    });
    if (!jobId) return jsonError("Could not save job", 500);

    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("applications").upsert(
      {
        user_id: DEFAULT_USER_ID,
        job_id: jobId,
        status: "queued",
        queue_date: today,
      },
      { onConflict: "user_id,job_id" },
    );
    await supabase.from("job_scores").upsert(
      {
        user_id: DEFAULT_USER_ID,
        job_id: jobId,
        score: 70,
        level_fit: true,
        skill_overlap: [],
        missing_skills: [],
        rationale: "Manually imported into today's queue.",
      },
      { onConflict: "user_id,job_id" },
    );

    const { data: queued } = await supabase
      .from("applications")
      .select("job_id")
      .eq("user_id", DEFAULT_USER_ID)
      .eq("status", "queued")
      .eq("queue_date", today);
    await rebuildTodayQueue(
      DEFAULT_USER_ID,
      (queued ?? []).map((row) => row.job_id as string),
    );

    return NextResponse.json({ jobId, url });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Import failed", 500);
  }
}
