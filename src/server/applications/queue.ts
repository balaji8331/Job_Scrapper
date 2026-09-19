import { MATCH_THRESHOLD } from "@/lib/constants";
import type { ExperienceLevel, Profile } from "@/lib/types";
import { rankJobs } from "@/server/ranking";
import {
  rebuildTodayQueue,
  upsertJobs,
  upsertScores,
} from "@/server/db/jobs";
import { searchAllSources } from "@/server/sources";

export async function runSearchAndQueue(input: {
  userId: string;
  role: string;
  level: ExperienceLevel;
  location?: string;
  remoteOk?: boolean;
  cities?: string[];
  profile: Profile | null;
}) {
  const { jobs, sourceCounts } = await searchAllSources({
    role: input.role,
    level: input.level,
    location: input.location,
    remoteOk: input.remoteOk,
    cities: input.cities,
  });

  const ranked = await rankJobs(jobs, input.role, input.level, input.profile);
  const ids = await upsertJobs(ranked.map((row) => row.job));

  const scoreRows = ranked
    .map((row) => {
      const jobId = ids.get(`${row.job.source}:${row.job.externalId}`);
      if (!jobId) return null;
      return { jobId, score: row.score };
    })
    .filter((row): row is { jobId: string; score: (typeof ranked)[number]["score"] } =>
      Boolean(row),
    );

  await upsertScores(input.userId, scoreRows);

  const orderedIds = ranked
    .filter((row) => row.score.levelFit && row.score.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score.score - a.score.score)
    .map((row) => ids.get(`${row.job.source}:${row.job.externalId}`))
    .filter((id): id is string => Boolean(id));

  const queue = await rebuildTodayQueue(input.userId, orderedIds);

  return {
    found: jobs.length,
    ranked: ranked.length,
    sourceCounts,
    ...queue,
  };
}
