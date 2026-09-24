import type { JobSearchQuery, NormalizedJob } from "@/lib/types";
import { loadRecentCrawlerJobs } from "@/server/crawler/from-db";
import { adzunaSource, searchIndiaEmployers } from "./adzuna";
import { searchAshby, searchGreenhouse, searchLever, searchWorkable } from "./ats";
import { harvestEmployersFromJobs } from "./harvest";
import { dedupeJobs, matchesIndia, matchesRole, resolveSearchCities } from "./http";
import { jsearchSource } from "./jsearch";

export async function searchAllSources(query: JobSearchQuery): Promise<{
  jobs: NormalizedJob[];
  sourceCounts: Record<string, number>;
  harvestedCompanies?: number;
}> {
  const cities = resolveSearchCities(query);
  const scoped = { ...query, cities, location: cities[0] ?? query.location };
  const settled = await Promise.allSettled([
    adzunaSource.search(scoped),
    searchIndiaEmployers(scoped),
    searchGreenhouse(),
    searchLever(),
    searchAshby(),
    searchWorkable(),
    loadRecentCrawlerJobs(scoped),
  ]);

  const buckets = settled.map((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  let jobs = buckets.flat();

  const afterFilter = jobs.filter(
    (job) => matchesIndia(job, scoped) && matchesRole(job, scoped.role),
  );

  if (afterFilter.length < 40) {
    const extra = await jsearchSource.search(scoped);
    jobs = jobs.concat(extra);
  }

  const filtered = dedupeJobs(
    jobs.filter((job) => matchesIndia(job, scoped) && matchesRole(job, scoped.role)),
  );

  const sourceCounts: Record<string, number> = {};
  for (const job of filtered) {
    sourceCounts[job.source] = (sourceCounts[job.source] ?? 0) + 1;
  }

  let harvestedCompanies = 0;
  try {
    const harvest = await harvestEmployersFromJobs(filtered, "search");
    harvestedCompanies = harvest.harvested;
  } catch {
    /* migration 003 may not be applied yet */
  }

  return { jobs: filtered, sourceCounts, harvestedCompanies };
}
