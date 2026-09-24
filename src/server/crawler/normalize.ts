import { createHash } from "node:crypto";
import type { NormalizedJob } from "@/lib/types";
import { isRemoteText, stripHtml } from "@/lib/text";

export const JOB_URL_PATTERNS = [
  /\/jobdetails/i,
  /\/job-details/i,
  /\/jobdetail/i,
  /\/jobs\/\d+/i,
  /\/job\/[a-z0-9-]+/i,
  /\/requisition\//i,
  /\/opportunities\/[a-z0-9-]+/i,
  /[?&](?:job|req|id)=/i,
];

const MARKETING_PATHS = [
  /\/explore-careers/i,
  /\/life-at-/i,
  /\/benefits/i,
  /\/work-environment/i,
  /\/jobsearch\/?#/i,
  /\/careers\/?#?$/i,
  /\/careers\/local\//i,
];

export function looksLikeJobUrl(url: string): boolean {
  if (MARKETING_PATHS.some((pattern) => pattern.test(url))) return false;
  return JOB_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function makeJobId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

export function contentHash(title: string, location: string, description: string): string {
  return createHash("sha256")
    .update(`${title}\n${location}\n${description}`)
    .digest("hex")
    .slice(0, 32);
}

export interface RawCrawlJob {
  url: string;
  title: string;
  location: string;
  description: string;
  employmentType?: string;
  postedAt?: string | null;
  jsonld?: Record<string, unknown>[];
}

export function toNormalizedJob(
  company: string,
  job: RawCrawlJob,
): NormalizedJob & { sourceUrl: string; contentHash: string; employmentType: string } {
  const description = stripHtml(job.description);
  const location = normalizeText(job.location);
  const title = normalizeText(job.title) || "Untitled";
  return {
    source: "crawler",
    externalId: makeJobId(job.url),
    title,
    company,
    location,
    applyUrl: job.url,
    description,
    salary: null,
    postedAt: job.postedAt ?? null,
    remote: isRemoteText(`${location} ${title} ${description}`),
    tags: [],
    sourceUrl: job.url,
    contentHash: contentHash(title, location, description),
    employmentType: job.employmentType ?? "",
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readLocation(jobPosting: Record<string, unknown>): string {
  const jobLocation = jobPosting.jobLocation;
  const locations = Array.isArray(jobLocation)
    ? jobLocation
    : jobLocation
      ? [jobLocation]
      : [];
  const parts: string[] = [];
  for (const item of locations) {
    const row = asRecord(item);
    const address = asRecord(row?.address) ?? row;
    if (!address) continue;
    for (const key of ["addressLocality", "addressRegion", "addressCountry", "name"]) {
      const value = address[key];
      if (typeof value === "string" && value.trim()) parts.push(value.trim());
    }
  }
  return parts.join(", ");
}

export function jobFromJsonLd(
  url: string,
  records: Record<string, unknown>[],
): RawCrawlJob | null {
  const posting = records.find((item) => {
    const type = item["@type"];
    return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
  });
  if (!posting) return null;
  return {
    url,
    title: typeof posting.title === "string" ? posting.title : "",
    location: readLocation(posting),
    description: typeof posting.description === "string" ? posting.description : "",
    employmentType:
      typeof posting.employmentType === "string"
        ? posting.employmentType
        : Array.isArray(posting.employmentType)
          ? posting.employmentType.filter((item) => typeof item === "string").join(", ")
          : "",
    postedAt: typeof posting.datePosted === "string" ? posting.datePosted : null,
    jsonld: records,
  };
}

export function collectJobUrlsFromNetworkPayload(data: unknown, baseUrl: string): string[] {
  return [
    ...new Set(collectJobsFromNetworkPayload(data, baseUrl).map((job) => job.url)),
  ];
}

export function collectJobsFromNetworkPayload(
  data: unknown,
  baseUrl: string,
): RawCrawlJob[] {
  const jobs: RawCrawlJob[] = [];

  const visit = (value: unknown, depth: number) => {
    if (depth > 8 || value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (typeof value !== "object") return;

    const row = value as Record<string, unknown>;
    const title =
      (typeof row.title === "string" && row.title) ||
      (typeof row.jobTitle === "string" && row.jobTitle) ||
      (typeof row.name === "string" && row.name) ||
      "";
    const urlValue =
      (typeof row.jobDetailUrl === "string" && row.jobDetailUrl) ||
      (typeof row.url === "string" && row.url) ||
      (typeof row.hostedUrl === "string" && row.hostedUrl) ||
      (typeof row.applyUrl === "string" && row.applyUrl) ||
      (typeof row.externalPath === "string" && row.externalPath) ||
      (typeof row.jobUrl === "string" && row.jobUrl) ||
      "";
    const location =
      (typeof row.country === "string" && row.country) ||
      (typeof row.location === "string" && row.location) ||
      (typeof row.city === "string" && row.city) ||
      (Array.isArray(row.locations)
        ? row.locations
            .map((item) =>
              typeof item === "string"
                ? item
                : typeof item === "object" && item && "name" in item
                  ? String((item as { name?: string }).name || "")
                  : "",
            )
            .filter(Boolean)
            .join(", ")
        : "") ||
      "";

    if (title && urlValue && !/search jobs|where will you shine|benefits for|workplace built/i.test(title)) {
      try {
        const absolute = new URL(urlValue.replace("{0}", "in-en"), baseUrl).toString();
        if (!looksLikeJobUrl(absolute) && !/jobdetails|job-details|requisition/i.test(absolute)) {
          /* still accept structured API rows even if pattern is novel */
        }
        jobs.push({
          url: absolute,
          title: normalizeText(title),
          location: normalizeText(location),
          description:
            typeof row.jobDescriptionClean === "string"
              ? row.jobDescriptionClean
              : typeof row.description === "string"
                ? row.description
                : typeof row.jobDescription === "string"
                  ? row.jobDescription
                  : "",
          employmentType:
            typeof row.jobScheduleDescription === "string"
              ? row.jobScheduleDescription
              : typeof row.employmentType === "string"
                ? row.employmentType
                : "",
          postedAt:
            typeof row.updateDate === "string"
              ? row.updateDate
              : typeof row.postedDate === "string"
                ? row.postedDate
                : typeof row.datePosted === "string"
                  ? row.datePosted
                  : null,
        });
      } catch {
        /* ignore bad urls */
      }
    }

    for (const item of Object.values(row)) visit(item, depth + 1);
  };

  visit(data, 0);
  return jobs;
}
