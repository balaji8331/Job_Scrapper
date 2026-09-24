import {
  CITY_ALIASES,
  FOCUS_CITIES,
  FOREIGN_LOCATION_MARKERS,
  INDIA_LOCATION_HINTS,
} from "@/lib/constants";
import { isRemoteText } from "@/lib/text";
import type { JobSearchQuery, NormalizedJob } from "@/lib/types";

export function cityAliases(city: string): string[] {
  const key = city.trim().toLowerCase();
  for (const [name, aliases] of Object.entries(CITY_ALIASES)) {
    if (name === key || aliases.includes(key)) return aliases;
  }
  return key ? [key] : [];
}

export function sameCity(left: string, right: string): boolean {
  const aliases = new Set(cityAliases(left));
  return cityAliases(right).some((alias) => aliases.has(alias));
}

export function resolveSearchCities(query: JobSearchQuery): string[] {
  const selected = (query.cities ?? []).map((city) => city.trim()).filter(Boolean);
  const seeds = selected.length ? selected : query.location?.trim() ? [query.location.trim()] : [...FOCUS_CITIES];
  if (seeds.some((city) => FOCUS_CITIES.some((focus) => sameCity(city, focus)))) {
    return [...FOCUS_CITIES];
  }
  return seeds;
}

function mentions(text: string, needle: string): boolean {
  return text.includes(needle);
}

function isIndiaText(text: string): boolean {
  if (mentions(text, "indianapolis")) return false;
  return INDIA_LOCATION_HINTS.some((hint) => mentions(text, hint));
}

function isForeignLocation(location: string): boolean {
  if (/\b(uk|usa|uae)\b/.test(location)) return true;
  return FOREIGN_LOCATION_MARKERS.some((marker) => mentions(location, marker));
}

export function matchesIndia(job: NormalizedJob, query: JobSearchQuery): boolean {
  const location = job.location.toLowerCase();
  const blob = `${location} ${job.title} ${job.description.slice(0, 500)}`.toLowerCase();
  const indiaInLocation = isIndiaText(location);
  if (location && isForeignLocation(location) && !indiaInLocation) return false;
  if (!indiaInLocation && !isIndiaText(blob)) return false;

  const cities = resolveSearchCities(query);
  const needles = cities.flatMap(cityAliases);
  const inRequestedCity = needles.some((needle) =>
    needle.length <= 3 ? mentions(location, needle) : mentions(location, needle) || mentions(blob, needle),
  );
  if (inRequestedCity) return true;

  const remote = job.remote || isRemoteText(location);
  if (query.remoteOk === false || !remote || !isIndiaText(blob)) return false;
  const pinnedElsewhere = Object.values(CITY_ALIASES).some((aliases) => {
    const inThisCity = aliases.some((alias) => mentions(location, alias));
    const requested = aliases.some((alias) => needles.includes(alias));
    return inThisCity && !requested;
  });
  return !pinnedElsewhere;
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
