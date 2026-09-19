import type { JobSearchQuery, NormalizedJob } from "@/lib/types";
import { adzunaSource } from "./adzuna";
import { searchAshby, searchGreenhouse, searchLever, searchWorkable } from "./ats";
import { dedupeJobs, matchesIndia, matchesRole } from "./http";
import { jsearchSource } from "./jsearch";

export async function searchAllSources(query: JobSearchQuery): Promise<{
  jobs: NormalizedJob[];
  sourceCounts: Record<string, number>;
}> {
  const settled = await Promise.allSettled([
    adzunaSource.search(query),
    searchGreenhouse(),
    searchLever(),
    searchAshby(),
    searchWorkable(),
  ]);

  const buckets = settled.map((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  let jobs = buckets.flat();

  const afterFilter = jobs.filter(
    (job) => matchesIndia(job, query) && matchesRole(job, query.role),
  );

  if (afterFilter.length < 40) {
    const extra = await jsearchSource.search(query);
    jobs = jobs.concat(extra);
  }

  const filtered = dedupeJobs(
    jobs.filter((job) => matchesIndia(job, query) && matchesRole(job, query.role)),
  );

  const sourceCounts: Record<string, number> = {};
  for (const job of filtered) {
    sourceCounts[job.source] = (sourceCounts[job.source] ?? 0) + 1;
  }

  return { jobs: filtered, sourceCounts };
}
