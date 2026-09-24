import { getServiceClient } from "@/lib/supabase";
import type { JobSearchQuery, NormalizedJob } from "@/lib/types";
import { matchesIndia, matchesRole } from "@/server/sources/http";

export async function loadRecentCrawlerJobs(
  query: JobSearchQuery,
  limit = 80,
): Promise<NormalizedJob[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "source, external_id, title, company, location, apply_url, description, salary, posted_at, remote, tags, company_id, source_url, content_hash, employment_type",
    )
    .eq("source", "crawler")
    .eq("status", "active")
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      source: "crawler" as const,
      externalId: row.external_id as string,
      title: row.title as string,
      company: row.company as string,
      location: (row.location as string) || "",
      applyUrl: row.apply_url as string,
      description: (row.description as string) || "",
      salary: (row.salary as string | null) ?? null,
      postedAt: (row.posted_at as string | null) ?? null,
      remote: Boolean(row.remote),
      tags: (row.tags as string[]) ?? [],
      companyId: (row.company_id as string | null) ?? null,
      sourceUrl: (row.source_url as string | null) ?? null,
      contentHash: (row.content_hash as string | null) ?? null,
      employmentType: (row.employment_type as string | null) ?? "",
    }))
    .filter((job) => matchesIndia(job, query) && matchesRole(job, query.role));
}
