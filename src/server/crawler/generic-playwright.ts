import { chromium, type Page } from "playwright";
import {
  collectJobUrlsFromNetworkPayload,
  collectJobsFromNetworkPayload,
  jobFromJsonLd,
  looksLikeJobUrl,
  normalizeText,
  type RawCrawlJob,
} from "./normalize";
import { attachJsonCapture } from "./network";

async function extractJsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  const scripts = page.locator('script[type="application/ld+json"]');
  const count = await scripts.count();
  for (let index = 0; index < count; index += 1) {
    const raw = await scripts.nth(index).textContent();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const type = row["@type"];
        if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) {
          records.push(row);
        }
        const graph = row["@graph"];
        if (Array.isArray(graph)) {
          for (const graphItem of graph) {
            if (!graphItem || typeof graphItem !== "object") continue;
            const graphRow = graphItem as Record<string, unknown>;
            const graphType = graphRow["@type"];
            if (
              graphType === "JobPosting" ||
              (Array.isArray(graphType) && graphType.includes("JobPosting"))
            ) {
              records.push(graphRow);
            }
          }
        }
      }
    } catch {
      continue;
    }
  }
  return records;
}

async function extractVisibleJob(page: Page): Promise<RawCrawlJob> {
  const title =
    normalizeText((await page.locator("h1").first().textContent().catch(() => "")) || "") ||
    normalizeText(await page.title());
  const locationCandidates = await page
    .locator("[class*='location' i], [data-testid*='location' i], [aria-label*='location' i]")
    .allTextContents()
    .catch(() => []);
  const location = normalizeText(locationCandidates.find(Boolean) || "");
  const description = normalizeText(
    (await page.locator("main, article, body").first().innerText().catch(() => "")) || "",
  );
  return {
    url: page.url(),
    title,
    location,
    description: description.slice(0, 12000),
  };
}

async function collectCandidateUrls(page: Page, networkUrls: string[]): Promise<string[]> {
  const links = await page.locator("a").evaluateAll((anchors) =>
    anchors
      .map((anchor) => {
        const element = anchor as HTMLAnchorElement;
        return {
          href: element.href || "",
          text: (element.innerText || "").trim(),
        };
      })
      .filter((link) => Boolean(link.href)),
  );

  const candidates = new Set<string>(networkUrls);
  for (const link of links) {
    if (looksLikeJobUrl(link.href)) candidates.add(link.href);
  }
  return [...candidates];
}

export interface CrawlCareerPageOptions {
  startUrl: string;
  maxJobs?: number;
  companyName?: string;
}

export async function crawlCareerPage(options: CrawlCareerPageOptions): Promise<{
  jobs: RawCrawlJob[];
  networkEndpoints: string[];
  candidateCount: number;
}> {
  const maxJobs = options.maxJobs ?? 40;
  const visited = new Set<string>();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    javaScriptEnabled: true,
    viewport: { width: 1440, height: 900 },
    userAgent: "IndiaJobOS/1.0 (personal job search; respectful crawler)",
  });
  const page = await context.newPage();
  const captured = attachJsonCapture(page);

  try {
    await page.goto(options.startUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => null);

    const networkJobs = captured.flatMap((item) =>
      collectJobsFromNetworkPayload(item.data, page.url()),
    );
    const networkUrls = [
      ...captured.flatMap((item) => collectJobUrlsFromNetworkPayload(item.data, page.url())),
      ...networkJobs.map((job) => job.url),
    ];
    const byUrl = new Map<string, RawCrawlJob>();
    for (const job of networkJobs) byUrl.set(job.url, job);

    // Prefer structured API payloads. Only scrape rendered links as a fallback.
    const candidates =
      byUrl.size >= Math.min(5, maxJobs)
        ? []
        : (await collectCandidateUrls(page, networkUrls)).slice(
            0,
            Math.max(0, maxJobs - byUrl.size),
          );

    for (const jobUrl of candidates) {
      if (byUrl.has(jobUrl) || visited.has(jobUrl)) continue;
      visited.add(jobUrl);
      const detail = await context.newPage();
      try {
        await detail.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await detail.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => null);
        const jsonld = await extractJsonLd(detail);
        const fromJson = jobFromJsonLd(jobUrl, jsonld);
        const visible = await extractVisibleJob(detail);
        byUrl.set(
          jobUrl,
          fromJson
            ? {
                ...fromJson,
                title: fromJson.title || visible.title,
                location: fromJson.location || visible.location,
                description: fromJson.description || visible.description,
              }
            : visible,
        );
      } catch {
        /* skip failed detail pages */
      } finally {
        await detail.close();
      }
    }

    return {
      jobs: [...byUrl.values()].slice(0, maxJobs),
      networkEndpoints: [...new Set(captured.map((item) => item.url))],
      candidateCount: candidates.length + networkJobs.length,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
