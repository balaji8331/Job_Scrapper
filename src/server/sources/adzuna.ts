import { INDIA_EMPLOYERS } from "@/lib/constants";
import { isRemoteText, stripHtml } from "@/lib/text";
import type { JobSearchQuery, NormalizedJob } from "@/lib/types";
import { fetchJson, resolveSearchCities } from "./http";
import type { JobSource } from "./types";

interface AdzunaResult {
  results?: Array<{
    id: number | string;
    title?: string;
    company?: { display_name?: string };
    location?: { display_name?: string };
    description?: string;
    redirect_url?: string;
    created?: string;
    salary_min?: number;
    salary_max?: number;
    salary_is_predicted?: string;
    contract_time?: string;
    category?: { label?: string };
  }>;
}

function salaryText(job: NonNullable<AdzunaResult["results"]>[number]): string | null {
  if (!job.salary_min && !job.salary_max) return null;
  const min = job.salary_min ? Math.round(job.salary_min) : null;
  const max = job.salary_max ? Math.round(job.salary_max) : null;
  if (min && max) return `₹${min.toLocaleString("en-IN")}–₹${max.toLocaleString("en-IN")}`;
  if (max) return `₹${max.toLocaleString("en-IN")}`;
  if (min) return `₹${min.toLocaleString("en-IN")}+`;
  return null;
}

function mapAdzunaJobs(batches: Array<AdzunaResult | null>): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  for (const batch of batches) {
    for (const item of batch?.results ?? []) {
      const location = item.location?.display_name ?? "";
      const description = stripHtml(item.description);
      jobs.push({
        source: "adzuna",
        externalId: String(item.id),
        title: item.title ?? "Untitled",
        company: item.company?.display_name ?? "Unknown",
        location,
        applyUrl: item.redirect_url ?? "",
        description,
        salary: salaryText(item),
        postedAt: item.created ?? null,
        remote: isRemoteText(`${location} ${item.title} ${description}`),
        tags: item.category?.label ? [item.category.label] : [],
      });
    }
  }
  return jobs.filter((job) => job.applyUrl);
}

async function searchAdzuna(what: string, where: string, pages: number[]): Promise<NormalizedJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];
  const batches = await Promise.all(
    pages.map((page) => {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: "50",
        what,
        where,
        content: "1",
      });
      return fetchJson<AdzunaResult>(
        `https://api.adzuna.com/v1/api/jobs/in/search/${page}?${params.toString()}`,
        {},
        7000,
      );
    }),
  );
  return mapAdzunaJobs(batches);
}

export const adzunaSource: JobSource = {
  id: "adzuna",
  async search(query: JobSearchQuery): Promise<NormalizedJob[]> {
    const cities = resolveSearchCities(query);
    const batches = await Promise.all(
      cities.map((city) => searchAdzuna(query.role, city, [1])),
    );
    return batches.flat();
  },
};

export async function searchIndiaEmployers(query: JobSearchQuery): Promise<NormalizedJob[]> {
  const batches = await Promise.all(
    INDIA_EMPLOYERS.map((company) => searchAdzuna(`${query.role} ${company}`, "India", [1])),
  );
  return batches.flat();
}
