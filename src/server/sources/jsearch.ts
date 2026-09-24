import { isRemoteText, stripHtml } from "@/lib/text";
import type { JobSearchQuery, NormalizedJob } from "@/lib/types";
import { fetchJson } from "./http";
import type { JobSource } from "./types";

interface JSearchResponse {
  data?: Array<{
    job_id?: string;
    job_title?: string;
    employer_name?: string;
    job_city?: string;
    job_country?: string;
    job_apply_link?: string;
    job_description?: string;
    job_posted_at_datetime_utc?: string;
    job_is_remote?: boolean;
    job_min_salary?: number;
    job_max_salary?: number;
    job_employment_type?: string;
  }>;
}

export const jsearchSource: JobSource = {
  id: "jsearch",
  async search(query: JobSearchQuery): Promise<NormalizedJob[]> {
    const key = process.env.RAPIDAPI_KEY;
    if (!key) return [];

    const location = query.location || query.cities?.[0] || "India";
    const params = new URLSearchParams({
      query: `${query.role} in ${location}`,
      page: "1",
      num_pages: "1",
      country: "in",
      date_posted: "month",
    });

    const data = await fetchJson<JSearchResponse>(
      `https://jsearch.p.rapidapi.com/search?${params.toString()}`,
      {
        headers: {
          "X-RapidAPI-Key": key,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      },
      7000,
    );

    return (data?.data ?? [])
      .filter((job) => {
        const country = (job.job_country ?? "").toLowerCase();
        return !country || country === "in" || country.includes("india");
      })
      .map((job) => {
        const locationLabel = [job.job_city, job.job_country].filter(Boolean).join(", ");
        return {
          source: "jsearch" as const,
          externalId: job.job_id ?? `${job.employer_name}-${job.job_title}`,
          title: job.job_title ?? "Untitled",
          company: job.employer_name ?? "Unknown",
          location: locationLabel,
          applyUrl: job.job_apply_link ?? "",
          description: stripHtml(job.job_description),
          salary:
            job.job_min_salary || job.job_max_salary
              ? `${job.job_min_salary ?? ""}–${job.job_max_salary ?? ""}`.replace(/^–|–$/g, "")
              : null,
          postedAt: job.job_posted_at_datetime_utc ?? null,
          remote: Boolean(job.job_is_remote) || isRemoteText(locationLabel),
          tags: job.job_employment_type ? [job.job_employment_type] : [],
        } satisfies NormalizedJob;
      })
      .filter((job) => job.applyUrl);
  },
};
