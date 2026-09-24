import { getServiceClient } from "@/lib/supabase";
import { loadAllCompanyConfigs, loadCompanyConfig } from "@/server/sources/config";
import { detectPortal, resolveConnector } from "@/server/sources/detector";
import { listCompanyCandidates } from "@/server/sources/harvest";
import { resolveCareerUrl } from "@/server/sources/resolve-career";
import { loadIndiaCompanySeed, seedToConfig } from "@/server/sources/seed";
import { configFromCareerUrl } from "@/server/sources/slug";
import type {
  CompanyConfig,
  CompanyRow,
  CrawlerSourceRow,
  PortalDetection,
  PortalType,
} from "@/server/sources/portal-types";

export async function listCompanies(): Promise<CompanyRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, country, career_url, active")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as CompanyRow[];
}

export async function listCrawlerSources(): Promise<
  Array<CrawlerSourceRow & { companies?: { name: string; slug: string } | null }>
> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("crawler_sources")
    .select(
      "id, company_id, name, career_url, portal_type, ats_slug, country, preferred_cities, preferred_roles, job_link_patterns, config, discovery, active, last_detected_at, last_crawled_at, companies(name, slug)",
    )
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as Array<
    CrawlerSourceRow & { companies?: { name: string; slug: string } | null }
  >;
}

export async function upsertCompanyFromConfig(config: CompanyConfig): Promise<CompanyRow> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .upsert(
      {
        name: config.name,
        slug: config.slug,
        country: config.country,
        career_url: config.career_url,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id, name, slug, country, career_url, active")
    .single();
  if (error) throw error;
  return data as CompanyRow;
}

export async function upsertCrawlerSourceFromConfig(
  companyId: string,
  config: CompanyConfig,
  detection?: PortalDetection,
): Promise<CrawlerSourceRow> {
  const supabase = getServiceClient();
  const portalType: PortalType = detection?.portalType ?? "unknown";
  const careerUrl = config.career_url.trim();
  if (!careerUrl) {
    throw new Error(`No career_url for ${config.slug}`);
  }
  const { data, error } = await supabase
    .from("crawler_sources")
    .upsert(
      {
        company_id: companyId,
        name: `${config.name} careers`,
        career_url: careerUrl,
        portal_type: portalType,
        ats_slug: detection?.atsSlug ?? null,
        country: config.country,
        preferred_cities: config.preferred_cities,
        preferred_roles: config.preferred_roles,
        job_link_patterns: config.job_link_patterns,
        config: {
          pagination: config.pagination ?? null,
          fields: config.fields ?? null,
          portal_hints: config.portal_hints ?? [],
        },
        discovery: detection
          ? {
              confidence: detection.confidence,
              evidence: detection.evidence,
              detected_career_url: detection.careerUrl,
            }
          : {},
        active: true,
        last_detected_at: detection ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,career_url" },
    )
    .select(
      "id, company_id, name, career_url, portal_type, ats_slug, country, preferred_cities, preferred_roles, job_link_patterns, config, discovery, active, last_detected_at, last_crawled_at",
    )
    .single();
  if (error) throw error;
  return data as CrawlerSourceRow;
}

export async function syncYamlConfigsToSupabase(): Promise<{
  companies: number;
  sources: number;
}> {
  const configs = loadAllCompanyConfigs();
  let companies = 0;
  let sources = 0;
  for (const config of configs) {
    const company = await upsertCompanyFromConfig(config);
    if (config.career_url.trim()) {
      await upsertCrawlerSourceFromConfig(company.id, config);
      sources += 1;
    }
    companies += 1;
  }
  return { companies, sources };
}

/** Sync curated India seed into companies (+ crawler_sources when career_url known). */
export async function syncIndiaSeedToSupabase(): Promise<{
  companies: number;
  sources: number;
  seedSize: number;
}> {
  const seed = loadIndiaCompanySeed();
  let companies = 0;
  let sources = 0;
  for (const row of seed) {
    const config = seedToConfig(row);
    const company = await upsertCompanyFromConfig(config);
    companies += 1;
    if (config.career_url.trim()) {
      await upsertCrawlerSourceFromConfig(company.id, config);
      sources += 1;
    }
  }
  return { companies, sources, seedSize: seed.length };
}

/** Paste any public career URL — no YAML required. */
export async function addCompanyFromCareerUrl(input: {
  careerUrl: string;
  name?: string;
  crawl?: boolean;
}): Promise<{
  company: CompanyRow;
  source: CrawlerSourceRow;
  detection: PortalDetection;
  connector: string;
}> {
  const careerUrl = input.careerUrl.trim();
  if (!careerUrl) throw new Error("careerUrl is required");
  let parsed: URL;
  try {
    parsed = new URL(careerUrl);
  } catch {
    throw new Error("Invalid career URL");
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error("careerUrl must be http(s)");
  }

  const config = configFromCareerUrl({
    careerUrl,
    name: input.name,
  });
  const detection = await detectPortal(config.career_url);
  if (detection.careerUrl) config.career_url = detection.careerUrl;

  const company = await upsertCompanyFromConfig(config);
  const source = await upsertCrawlerSourceFromConfig(company.id, config, detection);

  return {
    company,
    source,
    detection,
    connector: resolveConnector(detection.portalType),
  };
}

async function configForSlug(slug: string): Promise<{
  config: CompanyConfig;
  company: CompanyRow;
}> {
  const yaml = loadCompanyConfig(slug);
  const supabase = getServiceClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("id, name, slug, country, career_url, active")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;

  if (yaml) {
    const row = company
      ? await upsertCompanyFromConfig({
          ...yaml,
          career_url: yaml.career_url || (company.career_url as string) || "",
        })
      : await upsertCompanyFromConfig(yaml);
    return { config: { ...yaml, career_url: yaml.career_url || row.career_url }, company: row };
  }

  if (!company) throw new Error(`No company found for slug: ${slug}`);

  const { data: source } = await supabase
    .from("crawler_sources")
    .select("career_url, preferred_cities, preferred_roles, job_link_patterns, config")
    .eq("company_id", company.id)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cfg = (source?.config ?? {}) as {
    pagination?: CompanyConfig["pagination"];
    fields?: CompanyConfig["fields"];
    portal_hints?: string[];
  };

  return {
    company: company as CompanyRow,
    config: {
      name: company.name as string,
      slug: company.slug as string,
      career_url:
        (source?.career_url as string) || (company.career_url as string) || "",
      country: (company.country as string) || "India",
      preferred_cities: (source?.preferred_cities as string[]) || [
        "Bengaluru",
        "Hyderabad",
        "Chennai",
      ],
      preferred_roles: (source?.preferred_roles as string[]) || [],
      job_link_patterns: (source?.job_link_patterns as string[]) || [],
      pagination: cfg.pagination,
      fields: cfg.fields,
      portal_hints: cfg.portal_hints,
    },
  };
}

export async function detectAndPersistPortal(slug: string): Promise<{
  config: CompanyConfig;
  company: CompanyRow;
  source: CrawlerSourceRow;
  detection: PortalDetection;
  connector: string;
}> {
  const { config, company } = await configForSlug(slug);
  if (!config.career_url.trim()) {
    throw new Error(`No career URL for ${slug}. Paste a URL or run resolve first.`);
  }
  const detection = await detectPortal(config.career_url);
  const source = await upsertCrawlerSourceFromConfig(company.id, config, detection);

  return {
    config,
    company,
    source,
    detection,
    connector: resolveConnector(detection.portalType),
  };
}

export async function detectAllConfiguredPortals() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .select("slug")
    .eq("active", true)
    .neq("career_url", "")
    .order("name");
  if (error) throw error;

  const yamlSlugs = loadAllCompanyConfigs().map((c) => c.slug);
  const slugs = Array.from(
    new Set([...(data ?? []).map((row) => row.slug as string), ...yamlSlugs]),
  );

  const results = [];
  for (const slug of slugs) {
    try {
      results.push(await detectAndPersistPortal(slug));
    } catch {
      /* skip companies without resolvable career URLs */
    }
  }
  return results;
}

/** Resolve missing career URLs for seed/domain companies (batched). */
export async function resolveMissingCareerUrls(options: {
  limit?: number;
} = {}): Promise<{
  attempted: number;
  resolved: number;
  results: Array<{ slug: string; name: string; careerUrl: string | null }>;
}> {
  const limit = Math.min(Math.max(options.limit ?? 15, 1), 40);
  const supabase = getServiceClient();
  const seedBySlug = new Map(loadIndiaCompanySeed().map((row) => [row.slug, row]));

  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, slug, career_url")
    .eq("active", true)
    .or("career_url.eq.,career_url.is.null")
    .order("name")
    .limit(limit);
  if (error) throw error;

  const results: Array<{ slug: string; name: string; careerUrl: string | null }> = [];
  let resolved = 0;

  for (const company of companies ?? []) {
    const seed = seedBySlug.get(company.slug as string);
    const domain = seed?.domain || `${(company.slug as string).replace(/-/g, "")}.com`;
    const found = await resolveCareerUrl(domain, seed?.career_url || null);
    results.push({
      slug: company.slug as string,
      name: company.name as string,
      careerUrl: found.careerUrl,
    });
    if (!found.careerUrl) continue;

    const config: CompanyConfig = {
      name: company.name as string,
      slug: company.slug as string,
      career_url: found.careerUrl,
      country: "India",
      preferred_cities: seed?.preferred_cities || ["Bengaluru", "Hyderabad", "Chennai"],
      preferred_roles: ["Software Engineer"],
      job_link_patterns: [],
    };
    await upsertCompanyFromConfig(config);
    const detection = await detectPortal(found.careerUrl);
    await upsertCrawlerSourceFromConfig(company.id as string, config, detection);
    resolved += 1;
  }

  return { attempted: (companies ?? []).length, resolved, results };
}

export async function listPendingCrawlSlugs(options: {
  limit?: number;
  maxAgeHours?: number;
} = {}): Promise<string[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const maxAgeHours = options.maxAgeHours ?? 24;
  const cutoff = new Date(Date.now() - maxAgeHours * 3_600_000).toISOString();
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("crawler_sources")
    .select("last_crawled_at, companies!inner(slug, active)")
    .eq("active", true)
    .neq("career_url", "")
    .order("last_crawled_at", { ascending: true })
    .limit(200);
  if (error) throw error;

  const slugs: string[] = [];
  for (const row of data ?? []) {
    const company = row.companies as unknown as { slug: string; active: boolean } | null;
    if (!company?.active || !company.slug) continue;
    const last = row.last_crawled_at as string | null;
    if (last && last >= cutoff) continue;
    if (slugs.includes(company.slug)) continue;
    slugs.push(company.slug);
    if (slugs.length >= limit) break;
  }
  return slugs;
}

export async function getSourcesOverview() {
  const [companies, sources, yaml, seed, candidates] = await Promise.all([
    listCompanies(),
    listCrawlerSources(),
    Promise.resolve(loadAllCompanyConfigs()),
    Promise.resolve(loadIndiaCompanySeed()),
    listCompanyCandidates(50),
  ]);
  return {
    companies,
    sources,
    yaml: yaml.map((item) => ({
      slug: item.slug,
      name: item.name,
      career_url: item.career_url,
      preferred_cities: item.preferred_cities,
    })),
    seedSize: seed.length,
    candidates,
  };
}
