"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { EmptyState, Notice, SectionCard, Stat } from "@/components/ui/bits";
import {
  BoltIcon,
  BuildingIcon,
  LinkIcon,
  PlusIcon,
  RadarIcon,
  RefreshIcon,
} from "@/components/ui/icons";
import type { CompanyRow, CrawlerSourceRow, PortalType } from "@/server/sources/portal-types";

interface YamlRow {
  slug: string;
  name: string;
  career_url: string;
  preferred_cities: string[];
}

interface CrawlResult {
  slug: string;
  company: string;
  portalType: PortalType;
  found: number;
  upserted: number;
  error?: string;
}

interface CandidateRow {
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

const PORTAL_TONE: Partial<Record<PortalType, string>> = {
  greenhouse: "chip-emerald",
  lever: "chip-sky",
  ashby: "chip-violet",
  workable: "chip-sky",
  workday: "chip-amber",
  successfactors: "chip-amber",
  taleo: "chip-amber",
  generic: "",
  unknown: "chip-rose",
};

export function SourcesView() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [sources, setSources] = useState<CrawlerSourceRow[]>([]);
  const [yaml, setYaml] = useState<YamlRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [seedSize, setSeedSize] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<CrawlResult[]>([]);
  const [careerUrl, setCareerUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/sources");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load sources");
      setCompanies(data.companies ?? []);
      setSources(data.sources ?? []);
      setYaml(data.yaml ?? []);
      setCandidates(data.candidates ?? []);
      setSeedSize(data.seedSize ?? 0);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function post(url: string, body: Record<string, unknown>, label: string) {
    setBusy(label);
    setError("");
    setMessage(`${label}…`);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${label} failed`);
      return data;
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : `${label} failed`);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function syncYaml() {
    const data = await post("/api/sources", { action: "sync" }, "Syncing YAML configs");
    if (!data) return;
    setMessage(`Synced ${data.companies ?? 0} YAML companies.`);
    await load();
  }

  async function syncSeed() {
    const data = await post("/api/sources", { action: "seed" }, "Syncing India company seed");
    if (!data) return;
    setMessage(
      `Seeded ${data.companies ?? 0} companies (${data.sources ?? 0} with career URLs) from ${data.seedSize ?? seedSize} seed rows.`,
    );
    await load();
  }

  async function resolveUrls() {
    const data = await post(
      "/api/sources",
      { action: "resolve", limit: 15 },
      "Resolving career URLs",
    );
    if (!data) return;
    setMessage(
      `Resolved ${data.resolved ?? 0} of ${data.attempted ?? 0} companies this batch.`,
    );
    await load();
  }

  async function detectAll() {
    const data = await post("/api/sources", { action: "detect-all" }, "Detecting portals");
    if (!data) return;
    setMessage(`Fingerprinted ${data.count ?? 0} career sites.`);
    await load();
  }

  async function detectOne(slug: string) {
    const data = await post("/api/sources", { action: "detect", slug }, `Detecting ${slug}`);
    if (!data) return;
    setMessage(`${slug}: detected ${data.portalType} (${data.confidence} confidence).`);
    await load();
  }

  async function addCareerUrl(event: React.FormEvent) {
    event.preventDefault();
    if (!careerUrl.trim()) return;
    const data = await post(
      "/api/sources",
      {
        action: "add-url",
        careerUrl: careerUrl.trim(),
        name: companyName.trim() || undefined,
        crawl: true,
      },
      "Adding career URL",
    );
    if (!data) return;
    setCareerUrl("");
    setCompanyName("");
    const saved = data.crawl?.upserted ?? 0;
    setMessage(
      `Added ${data.company?.name ?? "company"} (${data.portalType}). ${saved} job${saved === 1 ? "" : "s"} in Company crawl.`,
    );
    if (data.crawl) setResults([data.crawl]);
    await load();
  }

  async function crawl(slug?: string, mode: "pending" | "slug" = "pending") {
    const data = await post(
      "/api/crawl",
      slug
        ? { slug, maxJobs: 20 }
        : { mode: "pending", limit: 20, maxJobs: 12, delayMs: 1500 },
      slug ? `Crawling ${slug}` : "Crawling next 20 pending",
    );
    if (!data) return;
    const list: CrawlResult[] = data.result ? [data.result] : (data.results ?? []);
    setResults(list);
    const upserted = list.reduce((sum, item) => sum + (item.upserted ?? 0), 0);
    setMessage(
      upserted > 0
        ? `Crawl finished (${list.length} companies). ${upserted} job${upserted === 1 ? "" : "s"} saved — open Company crawl.`
        : `Crawl finished (${list.length} companies). No India roles saved this batch.`,
    );
    await load();
    void mode;
  }

  const byCompany = useMemo(() => {
    const map = new Map<string, CrawlerSourceRow>();
    for (const source of sources) map.set(source.company_id, source);
    return map;
  }, [sources]);

  const detected = sources.filter(
    (source) => source.portal_type !== "unknown" && source.portal_type !== "generic",
  ).length;
  const crawledRecently = sources.filter((source) => Boolean(source.last_crawled_at)).length;
  const withCareerUrl = companies.filter((company) => {
    const source = byCompany.get(company.id);
    return Boolean(source?.career_url || company.career_url);
  }).length;

  const visibleCompanies = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return companies;
    return companies.filter((company) => {
      const source = byCompany.get(company.id);
      return `${company.name} ${company.slug} ${source?.career_url ?? company.career_url}`
        .toLowerCase()
        .includes(needle);
    });
  }, [companies, byCompany, filter]);

  return (
    <>
      <PageHeader
        title="Sources"
        description="Paste any public career URL, sync the India seed, then crawl in batches. Jobs land in Company crawl — not To apply."
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={syncSeed}
              disabled={Boolean(busy)}
            >
              <RefreshIcon />
              Sync seed ({seedSize || "…"})
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={resolveUrls}
              disabled={Boolean(busy)}
            >
              <RadarIcon />
              Resolve URLs
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => crawl()}
              disabled={Boolean(busy)}
            >
              <BoltIcon />
              Crawl next 20
            </button>
            <Link href="/queue?tab=crawler" className="btn btn-ghost">
              Open Company crawl
            </Link>
          </>
        }
      />

      <div className="page space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Companies tracked"
            value={companies.length}
            icon={<BuildingIcon />}
            tone="primary"
            foot={`${withCareerUrl} have a career URL`}
          />
          <Stat
            label="India seed"
            value={seedSize}
            icon={<RefreshIcon />}
            tone="sky"
            foot={`${yaml.length} YAML overrides`}
          />
          <Stat
            label="Portals identified"
            value={detected}
            icon={<RadarIcon />}
            tone="violet"
            foot={`${sources.length - detected} still generic or unknown`}
          />
          <Stat
            label="Crawled at least once"
            value={crawledRecently}
            icon={<BoltIcon />}
            tone="emerald"
            progress={sources.length ? (crawledRecently / Math.max(sources.length, 1)) * 100 : 0}
          />
        </div>

        {error ? <Notice kind="error">{error}</Notice> : null}
        {message && !error ? <Notice kind="info">{message}</Notice> : null}
        <Notice kind="warn">
          Playwright can open any public career page, but each company still needs a starting URL.
          Sync the {seedSize || "500+"} India seed, paste URLs, or harvest firms from search. Never
          bypasses CAPTCHAs or auto-applies.
        </Notice>

        <SectionCard
          title="Add any career URL"
          subtitle="No YAML required — detect portal type and crawl into Company crawl"
        >
          <form onSubmit={addCareerUrl} className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="label" htmlFor="career-url">
                Career / jobs URL
              </label>
              <input
                id="career-url"
                className="input"
                value={careerUrl}
                onChange={(event) => setCareerUrl(event.target.value)}
                placeholder="https://boards.greenhouse.io/… or company careers page"
                required
              />
            </div>
            <div className="md:col-span-4">
              <label className="label" htmlFor="company-name">
                Company name (optional)
              </label>
              <input
                id="company-name"
                className="input"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Inferred from the URL if empty"
              />
            </div>
            <div className="flex items-end md:col-span-3">
              <button type="submit" className="btn btn-primary w-full" disabled={Boolean(busy)}>
                <PlusIcon />
                Add &amp; crawl
              </button>
            </div>
          </form>
        </SectionCard>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={syncYaml}
            disabled={Boolean(busy)}
          >
            Sync YAML overrides
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={detectAll}
            disabled={Boolean(busy)}
          >
            Detect all portals
          </button>
          <input
            className="input max-w-xs"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter companies"
          />
        </div>

        <SectionCard
          title="Career portals"
          subtitle="Seeded + pasted companies with an active crawler source"
          action={
            <span className="tiny">
              {loading ? "Loading…" : `${visibleCompanies.length} shown`}
            </span>
          }
          flush
        >
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <EmptyState
              icon={<BuildingIcon />}
              title="No companies yet"
              hint="Press Sync seed to load ~500 India employers, or paste a career URL above."
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={syncSeed}>
                  Sync seed
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Portal</th>
                    <th>Cities</th>
                    <th>Last crawled</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleCompanies.map((company) => {
                    const source = byCompany.get(company.id);
                    const portal = source?.portal_type ?? (company.career_url ? "unknown" : "—");
                    const url = source?.career_url || company.career_url;
                    return (
                      <tr key={company.id}>
                        <td>
                          <p className="text-[13px] font-medium text-[var(--text)]">
                            {company.name}
                          </p>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="tiny hover:underline"
                            >
                              {shortUrl(url)}
                            </a>
                          ) : (
                            <span className="tiny">No career URL yet — run Resolve URLs</span>
                          )}
                        </td>
                        <td>
                          {portal === "—" ? (
                            <span className="chip">pending</span>
                          ) : (
                            <span className={`chip ${PORTAL_TONE[portal as PortalType] ?? ""}`}>
                              {portal}
                            </span>
                          )}
                          {source?.ats_slug ? (
                            <span className="mono ml-1.5">{source.ats_slug}</span>
                          ) : null}
                        </td>
                        <td className="tiny">
                          {(source?.preferred_cities ?? []).join(", ") || "Bengaluru, Hyderabad, Chennai"}
                        </td>
                        <td className="tiny">{relative(source?.last_crawled_at)}</td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              disabled={Boolean(busy) || !url}
                              onClick={() => detectOne(company.slug)}
                            >
                              Detect
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={Boolean(busy) || !url}
                              onClick={() => crawl(company.slug, "slug")}
                            >
                              Crawl
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {candidates.length ? (
          <SectionCard
            title="Harvested from searches"
            subtitle="Distinct India employers seen in Adzuna / JSearch / ATS results — promote by pasting their career URL"
            flush
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Domain guess</th>
                    <th>Seen in jobs</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 30).map((row) => (
                    <tr key={row.id}>
                      <td className="text-[var(--text)]">{row.name}</td>
                      <td className="tiny">{row.domain || "—"}</td>
                      <td>{row.job_count}</td>
                      <td>
                        <span className="chip">{row.status}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          onClick={() => {
                            setCompanyName(row.name);
                            setCareerUrl(
                              row.career_url ||
                                (row.domain ? `https://www.${row.domain}/careers` : ""),
                            );
                          }}
                        >
                          <LinkIcon />
                          Use in form
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ) : null}

        {results.length ? (
          <SectionCard title="Last crawl run" subtitle="Results from the most recent crawl" flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Portal</th>
                    <th>Found</th>
                    <th>Saved</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.slug}>
                      <td className="text-[var(--text)]">{result.company}</td>
                      <td>
                        <span className="chip">{result.portalType}</span>
                      </td>
                      <td>{result.found}</td>
                      <td className="font-medium text-[var(--text)]">{result.upserted}</td>
                      <td>
                        {result.error ? (
                          <span className="chip chip-rose" title={result.error}>
                            failed
                          </span>
                        ) : result.upserted > 0 ? (
                          <span className="chip chip-emerald">ok</span>
                        ) : (
                          <span className="chip chip-amber">no India roles</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}

function shortUrl(url: string) {
  if (!url) return "—";
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function relative(iso?: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
