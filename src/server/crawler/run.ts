import { matchesIndia } from "@/server/sources/http";
import type { JobSearchQuery, NormalizedJob } from "@/lib/types";
import { getServiceClient } from "@/lib/supabase";
import { listPendingCrawlSlugs } from "@/server/db/companies";
import { upsertJobs } from "@/server/db/jobs";
import { fetchAtsBoardJobs } from "@/server/sources/ats";
import { loadCompanyConfig } from "@/server/sources/config";
import { detectPortal } from "@/server/sources/detector";
import type { PortalType } from "@/server/sources/portal-types";
import { crawlCareerPage } from "./generic-playwright";
import { toNormalizedJob } from "./normalize";

function isForeignish(location: string): boolean {
  return /\b(united kingdom|united states|uk|usa|london|germany|singapore|canada|australia)\b/i.test(
    location,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CrawlSourceResult {
  slug: string;
  company: string;
  portalType: PortalType;
  careerUrl: string;
  found: number;
  upserted: number;
  networkEndpoints: string[];
  runId: string | null;
  via?: "ats" | "playwright";
  error?: string;
}

async function getSourceBySlug(slug: string) {
  const supabase = getServiceClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, slug, career_url")
    .eq("slug", slug)
    .maybeSingle();
  if (companyError) throw companyError;
  if (!company) return null;

  const { data: source, error: sourceError } = await supabase
    .from("crawler_sources")
    .select("*")
    .eq("company_id", company.id)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sourceError) throw sourceError;
  return { company, source };
}

async function collectJobs(input: {
  careerUrl: string;
  companyName: string;
  portalType: PortalType;
  atsSlug: string | null;
  maxJobs: number;
}): Promise<{ jobs: NormalizedJob[]; networkEndpoints: string[]; via: "ats" | "playwright" }> {
  const atsKinds = ["greenhouse", "lever", "ashby", "workable"] as const;
  if (
    input.atsSlug &&
    atsKinds.includes(input.portalType as (typeof atsKinds)[number])
  ) {
    try {
      const jobs = await fetchAtsBoardJobs({
        portalType: input.portalType as (typeof atsKinds)[number],
        atsSlug: input.atsSlug,
        companyName: input.companyName,
      });
      if (jobs.length) {
        return {
          jobs: jobs.slice(0, input.maxJobs),
          networkEndpoints: [],
          via: "ats",
        };
      }
    } catch {
      /* fall through to Playwright */
    }
  }

  const crawled = await crawlCareerPage({
    startUrl: input.careerUrl,
    maxJobs: input.maxJobs,
    companyName: input.companyName,
  });
  return {
    jobs: crawled.jobs.map((job) =>
      toNormalizedJob(input.companyName, {
        ...job,
        location: job.location?.trim() || "",
      }),
    ),
    networkEndpoints: crawled.networkEndpoints,
    via: "playwright",
  };
}

export async function crawlCompanySlug(
  slug: string,
  options: { maxJobs?: number; role?: string } = {},
): Promise<CrawlSourceResult> {
  const config = loadCompanyConfig(slug);
  const row = await getSourceBySlug(slug);
  const companyName = row?.company.name ?? config?.name ?? slug;
  const companyId = row?.company.id ?? null;
  const careerUrl =
    config?.career_url || row?.source?.career_url || row?.company.career_url || "";
  if (!careerUrl) {
    return {
      slug,
      company: companyName,
      portalType: "unknown",
      careerUrl: "",
      found: 0,
      upserted: 0,
      networkEndpoints: [],
      runId: null,
      error: "No career URL configured",
    };
  }

  const detection = await detectPortal(careerUrl);
  const portalType =
    detection.portalType !== "unknown"
      ? detection.portalType
      : ((row?.source?.portal_type as PortalType | undefined) || detection.portalType);
  const atsSlug = detection.atsSlug || (row?.source?.ats_slug as string | null) || null;
  const supabase = getServiceClient();

  let runId: string | null = null;
  if (row?.source?.id) {
    const { data: run } = await supabase
      .from("crawler_runs")
      .insert({
        source_id: row.source.id,
        status: "running",
        meta: { portalType, detection },
      })
      .select("id")
      .single();
    runId = (run?.id as string) ?? null;

    await supabase
      .from("crawler_sources")
      .update({
        portal_type: detection.portalType,
        ats_slug: detection.atsSlug,
        discovery: {
          confidence: detection.confidence,
          evidence: detection.evidence,
          detected_career_url: detection.careerUrl,
        },
        last_detected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.source.id);
  }

  try {
    const collected = await collectJobs({
      careerUrl,
      companyName,
      portalType,
      atsSlug,
      maxJobs: options.maxJobs ?? 30,
    });

    const cities =
      (row?.source?.preferred_cities as string[] | undefined) ||
      config?.preferred_cities ||
      ["Bengaluru", "Hyderabad", "Chennai"];
    const query: JobSearchQuery = {
      role: options.role || config?.preferred_roles?.[0] || "Software Engineer",
      level: "mid",
      cities,
      remoteOk: true,
      location: cities[0],
    };

    const normalized = collected.jobs
      .map((job) => {
        const location =
          job.location?.trim() ||
          (config?.country === "India" || !config ? "India" : "");
        const asCrawler: NormalizedJob = {
          ...job,
          location,
          companyId,
          source: "crawler",
          externalId:
            job.source === "crawler"
              ? job.externalId
              : `${job.source}:${job.externalId}`,
          tags: [
            ...(job.tags ?? []),
            ...(job.source !== "crawler" ? [job.source, "ats-board"] : []),
          ],
        };
        return asCrawler;
      })
      .filter((job) => {
        if (matchesIndia(job, query)) return true;
        const location = job.location.toLowerCase();
        if (isForeignish(location)) return false;
        return (
          /india|bengaluru|bangalore|hyderabad|chennai/.test(location) || !location
        );
      });

    const ids = await upsertJobs(normalized);
    const upserted = ids.size;

    if (row?.source?.id) {
      await supabase
        .from("crawler_sources")
        .update({
          last_crawled_at: new Date().toISOString(),
          discovery: {
            confidence: detection.confidence,
            evidence: detection.evidence,
            detected_career_url: detection.careerUrl,
            network_endpoints: collected.networkEndpoints.slice(0, 20),
            via: collected.via,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.source.id);
    }

    if (runId) {
      await supabase
        .from("crawler_runs")
        .update({
          status: upserted > 0 ? "success" : "partial",
          jobs_found: collected.jobs.length,
          jobs_upserted: upserted,
          finished_at: new Date().toISOString(),
          meta: {
            portalType,
            detection,
            via: collected.via,
            networkEndpoints: collected.networkEndpoints.slice(0, 20),
          },
        })
        .eq("id", runId);
    }

    return {
      slug,
      company: companyName,
      portalType,
      careerUrl,
      found: collected.jobs.length,
      upserted,
      networkEndpoints: collected.networkEndpoints.slice(0, 20),
      runId,
      via: collected.via,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawl failed";
    if (runId) {
      await supabase
        .from("crawler_runs")
        .update({
          status: "failed",
          error: message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    return {
      slug,
      company: companyName,
      portalType,
      careerUrl,
      found: 0,
      upserted: 0,
      networkEndpoints: [],
      runId,
      error: message,
    };
  }
}

export async function crawlConfiguredCompanies(
  slugs?: string[],
  options: { maxJobs?: number; delayMs?: number } = {},
) {
  const delayMs = options.delayMs ?? 1500;
  const targets =
    slugs && slugs.length
      ? slugs
      : await listPendingCrawlSlugs({ limit: 20, maxAgeHours: 24 });
  const results: CrawlSourceResult[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    results.push(await crawlCompanySlug(targets[i], options));
    if (i < targets.length - 1 && delayMs > 0) await sleep(delayMs);
  }
  return results;
}

/** Crawl next N sources that have not been crawled recently. */
export async function crawlPendingBatch(
  options: { limit?: number; maxJobs?: number; maxAgeHours?: number; delayMs?: number } = {},
) {
  const slugs = await listPendingCrawlSlugs({
    limit: options.limit ?? 20,
    maxAgeHours: options.maxAgeHours ?? 24,
  });
  return crawlConfiguredCompanies(slugs, {
    maxJobs: options.maxJobs ?? 15,
    delayMs: options.delayMs ?? 1500,
  });
}
