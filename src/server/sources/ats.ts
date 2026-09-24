import { isRemoteText, stripHtml } from "@/lib/text";
import type { NormalizedJob } from "@/lib/types";
import { ATS_COMPANIES } from "./companies";
import { fetchJson } from "./http";

interface GreenhouseBoard {
  jobs?: Array<{
    id: number;
    title?: string;
    absolute_url?: string;
    location?: { name?: string };
    updated_at?: string;
    metadata?: Array<{ name?: string; value?: string }>;
  }>;
}

export async function searchGreenhouse(): Promise<NormalizedJob[]> {
  const boards = ATS_COMPANIES.filter((company) => company.kind === "greenhouse");
  const results = await Promise.all(
    boards.map(async (company) => {
      const data = await fetchJson<GreenhouseBoard>(
        `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs`,
      );
      return (data?.jobs ?? []).map((job) => {
        const location = job.location?.name ?? "";
        return {
          source: "greenhouse" as const,
          externalId: String(job.id),
          title: job.title ?? "Untitled",
          company: company.name,
          location,
          applyUrl: job.absolute_url ?? "",
          description: "",
          salary: null,
          postedAt: job.updated_at ?? null,
          remote: isRemoteText(location),
          tags: [],
        } satisfies NormalizedJob;
      });
    }),
  );
  return results.flat().filter((job) => job.applyUrl);
}

interface LeverPosting {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  categories?: { location?: string; commitment?: string; team?: string };
  descriptionPlain?: string;
  description?: string;
  workplaceType?: string;
}

export async function searchLever(): Promise<NormalizedJob[]> {
  const boards = ATS_COMPANIES.filter((company) => company.kind === "lever");
  const results = await Promise.all(
    boards.map(async (company) => {
      const data = await fetchJson<LeverPosting[]>(
        `https://api.lever.co/v0/postings/${company.slug}?mode=json`,
      );
      return (data ?? []).map((job) => {
        const location = job.categories?.location ?? "";
        const description = stripHtml(job.descriptionPlain || job.description);
        return {
          source: "lever" as const,
          externalId: job.id ?? `${company.slug}-${job.text}`,
          title: job.text ?? "Untitled",
          company: company.name,
          location,
          applyUrl: job.applyUrl || job.hostedUrl || "",
          description,
          salary: null,
          postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
          remote:
            job.workplaceType === "remote" ||
            isRemoteText(`${location} ${job.workplaceType}`),
          tags: [job.categories?.team, job.categories?.commitment].filter(
            (tag): tag is string => Boolean(tag),
          ),
        } satisfies NormalizedJob;
      });
    }),
  );
  return results.flat().filter((job) => job.applyUrl);
}

interface AshbyBoard {
  jobs?: Array<{
    id?: string;
    title?: string;
    jobUrl?: string;
    applyUrl?: string;
    location?: string;
    locationName?: string;
    isRemote?: boolean;
    workplaceType?: string;
    departmentName?: string;
    descriptionHtml?: string;
    descriptionPlain?: string;
    publishedAt?: string;
  }>;
}

export async function searchAshby(): Promise<NormalizedJob[]> {
  const boards = ATS_COMPANIES.filter((company) => company.kind === "ashby");
  const results = await Promise.all(
    boards.map(async (company) => {
      const data = await fetchJson<AshbyBoard>(
        `https://api.ashbyhq.com/posting-api/job-board/${company.slug}?includeCompensation=true`,
      );
      return (data?.jobs ?? []).map((job) => {
        const location = job.locationName || job.location || "";
        return {
          source: "ashby" as const,
          externalId: job.id ?? `${company.slug}-${job.title}`,
          title: job.title ?? "Untitled",
          company: company.name,
          location,
          applyUrl: job.applyUrl || job.jobUrl || "",
          description: stripHtml(job.descriptionPlain || job.descriptionHtml),
          salary: null,
          postedAt: job.publishedAt ?? null,
          remote:
            Boolean(job.isRemote) ||
            job.workplaceType === "Remote" ||
            isRemoteText(location),
          tags: job.departmentName ? [job.departmentName] : [],
        } satisfies NormalizedJob;
      });
    }),
  );
  return results.flat().filter((job) => job.applyUrl);
}

interface WorkableWidget {
  jobs?: Array<{
    id?: string | number;
    title?: string;
    shortcode?: string;
    url?: string;
    location?: { city?: string; country?: string; telecommuting?: boolean } | string;
    department?: string;
    description?: string;
    created_at?: string;
    employment_type?: string;
  }>;
}

export async function searchWorkable(): Promise<NormalizedJob[]> {
  const boards = ATS_COMPANIES.filter((company) => company.kind === "workable");
  const results = await Promise.all(
    boards.map(async (company) => {
      const data = await fetchJson<WorkableWidget>(
        `https://apply.workable.com/api/v1/widget/accounts/${company.slug}?details=true`,
      );
      return (data?.jobs ?? []).map((job) => {
        const loc =
          typeof job.location === "string"
            ? job.location
            : [job.location?.city, job.location?.country].filter(Boolean).join(", ");
        const remote =
          (typeof job.location === "object" && job.location?.telecommuting) ||
          isRemoteText(loc);
        return {
          source: "workable" as const,
          externalId: String(job.shortcode ?? job.id ?? `${company.slug}-${job.title}`),
          title: job.title ?? "Untitled",
          company: company.name,
          location: loc,
          applyUrl:
            job.url ||
            (job.shortcode
              ? `https://apply.workable.com/${company.slug}/j/${job.shortcode}/`
              : ""),
          description: stripHtml(job.description),
          salary: null,
          postedAt: job.created_at ?? null,
          remote: Boolean(remote),
          tags: [job.department, job.employment_type].filter(
            (tag): tag is string => Boolean(tag),
          ),
        } satisfies NormalizedJob;
      });
    }),
  );
  return results.flat().filter((job) => job.applyUrl);
}

/** Fetch a single public ATS board by slug (used when portal detector finds an ATS). */
export async function fetchAtsBoardJobs(input: {
  portalType: "greenhouse" | "lever" | "ashby" | "workable";
  atsSlug: string;
  companyName: string;
}): Promise<NormalizedJob[]> {
  const { portalType, atsSlug, companyName } = input;
  if (portalType === "greenhouse") {
    const data = await fetchJson<GreenhouseBoard>(
      `https://boards-api.greenhouse.io/v1/boards/${atsSlug}/jobs`,
    );
    return (data?.jobs ?? [])
      .map((job) => {
        const location = job.location?.name ?? "";
        return {
          source: "greenhouse" as const,
          externalId: String(job.id),
          title: job.title ?? "Untitled",
          company: companyName,
          location,
          applyUrl: job.absolute_url ?? "",
          description: "",
          salary: null,
          postedAt: job.updated_at ?? null,
          remote: isRemoteText(location),
          tags: [],
        } satisfies NormalizedJob;
      })
      .filter((job) => job.applyUrl);
  }
  if (portalType === "lever") {
    const data = await fetchJson<LeverPosting[]>(
      `https://api.lever.co/v0/postings/${atsSlug}?mode=json`,
    );
    return (data ?? [])
      .map((job) => {
        const location = job.categories?.location ?? "";
        return {
          source: "lever" as const,
          externalId: job.id ?? `${atsSlug}-${job.text}`,
          title: job.text ?? "Untitled",
          company: companyName,
          location,
          applyUrl: job.applyUrl || job.hostedUrl || "",
          description: stripHtml(job.descriptionPlain || job.description),
          salary: null,
          postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
          remote:
            job.workplaceType === "remote" ||
            isRemoteText(`${location} ${job.workplaceType}`),
          tags: [job.categories?.team, job.categories?.commitment].filter(
            (tag): tag is string => Boolean(tag),
          ),
        } satisfies NormalizedJob;
      })
      .filter((job) => job.applyUrl);
  }
  if (portalType === "ashby") {
    const data = await fetchJson<AshbyBoard>(
      `https://api.ashbyhq.com/posting-api/job-board/${atsSlug}?includeCompensation=true`,
    );
    return (data?.jobs ?? [])
      .map((job) => {
        const location = job.locationName || job.location || "";
        return {
          source: "ashby" as const,
          externalId: job.id ?? `${atsSlug}-${job.title}`,
          title: job.title ?? "Untitled",
          company: companyName,
          location,
          applyUrl: job.applyUrl || job.jobUrl || "",
          description: stripHtml(job.descriptionPlain || job.descriptionHtml),
          salary: null,
          postedAt: job.publishedAt ?? null,
          remote:
            Boolean(job.isRemote) ||
            job.workplaceType === "Remote" ||
            isRemoteText(location),
          tags: job.departmentName ? [job.departmentName] : [],
        } satisfies NormalizedJob;
      })
      .filter((job) => job.applyUrl);
  }
  const data = await fetchJson<WorkableWidget>(
    `https://apply.workable.com/api/v1/widget/accounts/${atsSlug}?details=true`,
  );
  return (data?.jobs ?? [])
    .map((job) => {
      const loc =
        typeof job.location === "string"
          ? job.location
          : [job.location?.city, job.location?.country].filter(Boolean).join(", ");
      return {
        source: "workable" as const,
        externalId: String(job.shortcode ?? job.id ?? `${atsSlug}-${job.title}`),
        title: job.title ?? "Untitled",
        company: companyName,
        location: loc,
        applyUrl:
          job.url ||
          (job.shortcode ? `https://apply.workable.com/${atsSlug}/j/${job.shortcode}/` : ""),
        description: stripHtml(job.description),
        salary: null,
        postedAt: job.created_at ?? null,
        remote:
          (typeof job.location === "object" && Boolean(job.location?.telecommuting)) ||
          isRemoteText(loc),
        tags: [job.department, job.employment_type].filter(
          (tag): tag is string => Boolean(tag),
        ),
      } satisfies NormalizedJob;
    })
    .filter((job) => job.applyUrl);
}
