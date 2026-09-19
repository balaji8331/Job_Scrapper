import { isRemoteText, stripHtml } from "@/lib/text";
import type { JobSearchQuery, NormalizedJob } from "@/lib/types";
import { fetchJson } from "./http";
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

export const adzunaSource: JobSource = {
  id: "adzuna",
  async search(query: JobSearchQuery): Promise<NormalizedJob[]> {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) return [];

    const where = query.location || query.cities?.[0] || "india";
    const pages = [1, 2];
    const batches = await Promise.all(
      pages.map((page) => {
        const params = new URLSearchParams({
          app_id: appId,
          app_key: appKey,
          results_per_page: "50",
          what: query.role,
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
  },
};
