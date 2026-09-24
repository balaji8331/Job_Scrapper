import { getServiceClient } from "@/lib/supabase";
import type { NormalizedJob } from "@/lib/types";
import { slugifyName } from "./slug";

export interface CompanyCandidateRow {
  id: string;
  name: string;
  slug: string;
  domain: string;
  career_url: string;
  source: string;
  status: string;
  job_count: number;
  last_seen_at: string;
}

/** Upsert distinct employers seen in India search results as crawl candidates. */
export async function harvestEmployersFromJobs(
  jobs: NormalizedJob[],
  source = "search",
): Promise<{ harvested: number; names: string[] }> {
  const supabase = getServiceClient();
  const bySlug = new Map<
    string,
    { name: string; slug: string; count: number; sampleUrl: string }
  >();

  for (const job of jobs) {
    const name = job.company?.trim();
    if (!name || name.length < 2) continue;
    if (/confidential|not disclosed|hiring for|client of/i.test(name)) continue;
    const slug = slugifyName(name);
    const current = bySlug.get(slug);
    if (current) {
      current.count += 1;
      continue;
    }
    bySlug.set(slug, {
      name,
      slug,
      count: 1,
      sampleUrl: job.applyUrl || "",
    });
  }

  const names: string[] = [];
  for (const item of bySlug.values()) {
    const domain = guessDomain(item.name, item.sampleUrl);
    const { error } = await supabase.from("company_candidates").upsert(
      {
        name: item.name,
        slug: item.slug,
        domain,
        career_url: "",
        source,
        status: "pending",
        job_count: item.count,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    );
    if (!error) names.push(item.name);
  }

  return { harvested: names.length, names: names.slice(0, 40) };
}

export async function listCompanyCandidates(limit = 100): Promise<CompanyCandidateRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("company_candidates")
    .select("id, name, slug, domain, career_url, source, status, job_count, last_seen_at")
    .order("job_count", { ascending: false })
    .limit(limit);
  if (error) {
    // Table may not exist until migration 003 is applied
    if (/company_candidates|does not exist|42P01/i.test(error.message)) return [];
    throw error;
  }
  return (data ?? []) as CompanyCandidateRow[];
}

function guessDomain(name: string, applyUrl: string): string {
  try {
    if (applyUrl) {
      const host = new URL(applyUrl).hostname.replace(/^www\./, "");
      const skip = /greenhouse|lever|ashby|workable|myworkdayjobs|linkedin|naukri|indeed|adzuna|glassdoor/i;
      if (!skip.test(host)) return host;
    }
  } catch {
    /* ignore */
  }
  return `${slugifyName(name).replace(/-/g, "")}.com`;
}
