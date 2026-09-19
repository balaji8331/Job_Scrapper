import { NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/user";
import { getServiceClient } from "@/lib/supabase";
import { getProfile } from "@/server/db/profile";
import { jsonError, requireSupabase } from "@/server/http";
import { downloadStoredPdf, generateAndStoreResume } from "@/server/resume/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as { jobId?: string };
    if (!body.jobId) return jsonError("jobId is required");

    const profile = await getProfile(DEFAULT_USER_ID);
    if (!profile?.fullName) {
      return jsonError("Save your profile before generating a resume", 400);
    }

    const supabase = getServiceClient();
    const { data: job, error } = await supabase
      .from("jobs")
      .select("id, title, company, description")
      .eq("id", body.jobId)
      .single();
    if (error || !job) return jsonError("Job not found", 404);

    const result = await generateAndStoreResume({
      userId: DEFAULT_USER_ID,
      jobId: job.id as string,
      profile,
      job: {
        title: job.title as string,
        company: job.company as string,
        description: job.description as string,
      },
    });

    return new NextResponse(Buffer.from(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug(job.company as string)}-${slug(job.title as string)}.pdf"`,
        "X-Used-Gemini": result.usedGemini ? "1" : "0",
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Resume generation failed", 500);
  }
}

export async function GET(request: Request) {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) return jsonError("jobId is required");

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("resume_versions")
    .select("pdf_path")
    .eq("user_id", DEFAULT_USER_ID)
    .eq("job_id", jobId)
    .maybeSingle();
  if (!data?.pdf_path) return jsonError("No stored resume yet", 404);
  const pdf = await downloadStoredPdf(data.pdf_path as string);
  if (!pdf) return jsonError("PDF missing from storage", 404);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="resume-${jobId}.pdf"`,
    },
  });
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}
