import { DAILY_TARGET, QUEUE_SIZE } from "@/lib/constants";
import { getServiceClient } from "@/lib/supabase";
import type {
  ApplicationStatus,
  JobScore,
  NormalizedJob,
  QueueJob,
} from "@/lib/types";

export async function upsertJobs(jobs: NormalizedJob[]): Promise<Map<string, string>> {
  const supabase = getServiceClient();
  const idByKey = new Map<string, string>();
  if (jobs.length === 0) return idByKey;

  const rows = jobs.map((job) => ({
    source: job.source,
    external_id: job.externalId,
    title: job.title,
    company: job.company,
    location: job.location,
    apply_url: job.applyUrl,
    description: job.description,
    salary: job.salary ?? null,
    posted_at: job.postedAt,
    remote: job.remote,
    tags: job.tags,
    raw: job,
  }));

  const { data, error } = await supabase
    .from("jobs")
    .upsert(rows, { onConflict: "source,external_id" })
    .select("id, source, external_id");
  if (error) throw error;
  for (const row of data ?? []) {
    idByKey.set(`${row.source}:${row.external_id}`, row.id as string);
  }
  return idByKey;
}

export async function upsertScores(
  userId: string,
  items: Array<{ jobId: string; score: JobScore }>,
) {
  if (items.length === 0) return;
  const supabase = getServiceClient();
  const { error } = await supabase.from("job_scores").upsert(
    items.map((item) => ({
      user_id: userId,
      job_id: item.jobId,
      score: item.score.score,
      level_fit: item.score.levelFit,
      skill_overlap: item.score.skillOverlap,
      missing_skills: item.score.missingSkills,
      rationale: item.score.rationale,
      ranked_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,job_id" },
  );
  if (error) throw error;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function rebuildTodayQueue(userId: string, jobIdsInRankOrder: string[]) {
  const supabase = getServiceClient();
  const today = todayIsoDate();

  const { data: existing, error: existingError } = await supabase
    .from("applications")
    .select("id, job_id, status")
    .eq("user_id", userId);
  if (existingError) throw existingError;

  const byJob = new Map(
    (existing ?? []).map((row) => [row.job_id as string, row]),
  );
  const blocked = new Set(
    (existing ?? [])
      .filter((row) =>
        ["applied", "interview", "rejected", "offer"].includes(row.status as string),
      )
      .map((row) => row.job_id as string),
  );

  const selected: string[] = [];
  for (const jobId of jobIdsInRankOrder) {
    if (blocked.has(jobId)) continue;
    selected.push(jobId);
    if (selected.length >= QUEUE_SIZE) break;
  }

  const staleQueued = (existing ?? []).filter(
    (row) =>
      row.status === "queued" &&
      !selected.includes(row.job_id as string),
  );
  if (staleQueued.length) {
    await supabase
      .from("applications")
      .update({ status: "saved", queue_date: null, updated_at: new Date().toISOString() })
      .in(
        "id",
        staleQueued.map((row) => row.id),
      );
  }

  for (const jobId of selected) {
    const current = byJob.get(jobId);
    if (current) {
      await supabase
        .from("applications")
        .update({
          status: current.status === "applied" ? current.status : "queued",
          queue_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);
    } else {
      await supabase.from("applications").insert({
        user_id: userId,
        job_id: jobId,
        status: "queued",
        queue_date: today,
      });
    }
  }

  const { count: appliedCount } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "applied")
    .gte("applied_at", `${today}T00:00:00.000Z`);

  await supabase.from("daily_stats").upsert(
    {
      user_id: userId,
      stat_date: today,
      queued: selected.length,
      applied: appliedCount ?? 0,
      target: DAILY_TARGET,
    },
    { onConflict: "user_id,stat_date" },
  );

  return { queued: selected.length, applied: appliedCount ?? 0 };
}

export async function getTodayQueue(userId: string): Promise<{
  jobs: QueueJob[];
  stats: { date: string; queued: number; applied: number; target: number };
}> {
  return getTodayQueueFallback(userId, todayIsoDate());
}

async function getTodayQueueFallback(userId: string, today: string) {
  const supabase = getServiceClient();
  const { data: apps, error } = await supabase
    .from("applications")
    .select("id, status, job_id, jobs(*)")
    .eq("user_id", userId)
    .or(`and(queue_date.eq.${today},status.eq.queued),and(status.eq.applied,applied_at.gte.${today}T00:00:00.000Z)`);
  if (error) throw error;

  const jobIds = (apps ?? []).map((row) => row.job_id as string);
  const { data: scores } = jobIds.length
    ? await supabase
        .from("job_scores")
        .select("*")
        .eq("user_id", userId)
        .in("job_id", jobIds)
    : { data: [] };
  const scoreByJob = new Map((scores ?? []).map((row) => [row.job_id as string, row]));

  const { data: resumes } = jobIds.length
    ? await supabase
        .from("resume_versions")
        .select("job_id, pdf_path")
        .eq("user_id", userId)
        .in("job_id", jobIds)
    : { data: [] };
  const resumeByJob = new Map((resumes ?? []).map((row) => [row.job_id as string, row]));

  const jobs: QueueJob[] = (apps ?? [])
    .map((row) => {
      const rawJob = row.jobs as unknown;
      const job = (Array.isArray(rawJob) ? rawJob[0] : rawJob) as {
        id: string;
        source: QueueJob["source"];
        title: string;
        company: string;
        location: string;
        apply_url: string;
        description: string;
        salary: string | null;
        remote: boolean;
        tags: string[];
      } | null;
      if (!job) return null;
      const score = scoreByJob.get(job.id);
      const resume = resumeByJob.get(job.id);
      return {
        id: job.id,
        source: job.source,
        title: job.title,
        company: job.company,
        location: job.location,
        applyUrl: job.apply_url,
        description: job.description,
        salary: job.salary,
        remote: job.remote,
        tags: job.tags ?? [],
        score: (score?.score as number) ?? 0,
        levelFit: Boolean(score?.level_fit ?? true),
        skillOverlap: (score?.skill_overlap as string[]) ?? [],
        missingSkills: (score?.missing_skills as string[]) ?? [],
        rationale: (score?.rationale as string) ?? "",
        status: row.status as QueueJob["status"],
        applicationId: row.id as string,
        hasResume: Boolean(resume),
        pdfPath: (resume?.pdf_path as string | null) ?? null,
      } as QueueJob;
    })
    .filter((row): row is QueueJob => row !== null)
    .sort((a, b) => b.score - a.score);

  const { data: statsRow } = await supabase
    .from("daily_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("stat_date", today)
    .maybeSingle();

  const applied = jobs.filter((job) => job.status === "applied").length;
  const queued = jobs.filter((job) => job.status === "queued").length;

  return {
    jobs,
    stats: {
      date: today,
      queued: (statsRow?.queued as number) ?? queued,
      applied: (statsRow?.applied as number) ?? applied,
      target: (statsRow?.target as number) ?? DAILY_TARGET,
    },
  };
}

export async function listApplications(userId: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("applications")
    .select("id, status, notes, applied_at, queue_date, updated_at, job_id, jobs(*)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const rawJob = row.jobs as unknown;
    const job = (Array.isArray(rawJob) ? rawJob[0] : rawJob) as {
      id: string;
      title: string;
      company: string;
      location: string;
      apply_url: string;
      source: string;
    } | null;
    return {
      id: row.id as string,
      status: row.status as ApplicationStatus,
      notes: row.notes as string,
      appliedAt: row.applied_at as string | null,
      queueDate: row.queue_date as string | null,
      jobId: row.job_id as string,
      title: job?.title ?? "",
      company: job?.company ?? "",
      location: job?.location ?? "",
      applyUrl: job?.apply_url ?? "",
      source: job?.source ?? "",
    };
  });
}

export async function updateApplication(
  userId: string,
  applicationId: string,
  patch: { status?: ApplicationStatus; notes?: string },
) {
  const supabase = getServiceClient();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status) updates.status = patch.status;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.status === "applied") updates.applied_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", applicationId)
    .eq("user_id", userId)
    .select("id, status")
    .single();
  if (error) throw error;

  if (patch.status === "applied") {
    const today = todayIsoDate();
    const { count } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "applied")
      .gte("applied_at", `${today}T00:00:00.000Z`);
    const { data: current } = await supabase
      .from("daily_stats")
      .select("queued")
      .eq("user_id", userId)
      .eq("stat_date", today)
      .maybeSingle();
    await supabase.from("daily_stats").upsert(
      {
        user_id: userId,
        stat_date: today,
        queued: (current?.queued as number) ?? 0,
        applied: count ?? 0,
        target: DAILY_TARGET,
      },
      { onConflict: "user_id,stat_date" },
    );
  }
  return data;
}

export async function importJob(job: NormalizedJob) {
  const ids = await upsertJobs([job]);
  return ids.get(`${job.source}:${job.externalId}`);
}
