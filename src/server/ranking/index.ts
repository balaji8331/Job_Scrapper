import { GEMINI_SHORTLIST, MATCH_THRESHOLD } from "@/lib/constants";
import type { ExperienceLevel, JobScore, NormalizedJob, Profile } from "@/lib/types";
import { geminiRescore } from "./gemini";
import { scoreJob } from "./rules";

export async function rankJobs(
  jobs: NormalizedJob[],
  role: string,
  level: ExperienceLevel,
  profile: Profile | null,
): Promise<Array<{ job: NormalizedJob; score: JobScore }>> {
  const scored = jobs.map((job) => ({
    job,
    score: scoreJob(job, role, level, profile),
  }));

  scored.sort((a, b) => b.score.score - a.score.score);
  const shortlist = scored
    .filter((row) => row.score.levelFit && row.score.score >= MATCH_THRESHOLD)
    .slice(0, Math.min(GEMINI_SHORTLIST, 24));

  const gemini = await geminiRescore(
    shortlist.map((row) => ({ job: row.job, base: row.score })),
    role,
    level,
    profile,
  );

  return scored.map((row) => {
    const key = `${row.job.source}:${row.job.externalId}`;
    return { job: row.job, score: gemini.get(key) ?? row.score };
  });
}
