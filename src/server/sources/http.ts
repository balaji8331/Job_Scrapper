import { INDIA_LOCATION_HINTS } from "@/lib/constants";
import { isRemoteText } from "@/lib/text";
import type { JobSearchQuery, NormalizedJob } from "@/lib/types";

export function matchesIndia(job: NormalizedJob, query: JobSearchQuery): boolean {
  const haystack = `${job.location} ${job.title} ${job.description}`.toLowerCase();
  const inIndia = INDIA_LOCATION_HINTS.some((hint) => haystack.includes(hint));
  const remote = job.remote || isRemoteText(haystack);

  if (inIndia) {
    if (query.location) {
      return haystack.includes(query.location.toLowerCase()) || remote;
    }
    if (query.cities && query.cities.length > 0) {
      return query.cities.some((city) => haystack.includes(city.toLowerCase())) || remote;
    }
    return true;
  }

  if (query.remoteOk !== false && remote) return true;
  return false;
}

export function matchesRole(job: NormalizedJob, role: string): boolean {
  const roleTokens = role
    .toLowerCase()
    .split(/[\s/]+/)
    .filter((token) => token.length > 2 && !["and", "the", "for"].includes(token));
  const haystack = `${job.title} ${job.tags.join(" ")} ${job.description.slice(0, 500)}`.toLowerCase();
  if (roleTokens.length === 0) return true;
  const hits = roleTokens.filter((token) => haystack.includes(token)).length;
  return hits >= Math.min(2, roleTokens.length) || haystack.includes(role.toLowerCase());
}

export function dedupeJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seenIds = new Set<string>();
  const seenCompanyTitle = new Set<string>();
  const result: NormalizedJob[] = [];

  for (const job of jobs) {
    const sourceKey = `${job.source}:${job.externalId}`;
    const companyTitle = `${job.company.trim().toLowerCase()}::${job.title.trim().toLowerCase()}`;
    if (seenIds.has(sourceKey) || seenCompanyTitle.has(companyTitle)) continue;
    seenIds.add(sourceKey);
    seenCompanyTitle.add(companyTitle);
    result.push(job);
  }
  return result;
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "IndiaJobOS/1.0 (personal job search)",
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
