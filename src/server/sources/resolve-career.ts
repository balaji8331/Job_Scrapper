import { detectPortal } from "./detector";

export interface CareerResolveResult {
  careerUrl: string | null;
  tried: string[];
  portalType?: string;
  confidence?: string;
  evidence?: string[];
}

function candidateUrls(domain: string): string[] {
  const host = domain
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!host) return [];
  return [
    `https://careers.${host}/`,
    `https://jobs.${host}/`,
    `https://www.${host}/careers`,
    `https://www.${host}/careers/`,
    `https://www.${host}/careers/jobs`,
    `https://${host}/careers`,
    `https://${host}/careers/`,
    `https://${host}/jobs`,
    `https://www.${host}/about/careers`,
    `https://www.${host}/en/careers`,
    `https://www.${host}/in/careers`,
  ];
}

async function probeUrl(url: string): Promise<{ ok: boolean; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "IndiaJobOS/1.0 (career resolver; personal job search)",
      },
    });
    if (!response.ok) return null;
    const finalUrl = response.url || url;
    // Reject obvious non-career landings
    if (/login|signin|account|cart|shop/i.test(finalUrl) && !/career|job/i.test(finalUrl)) {
      return null;
    }
    return { ok: true, finalUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Try common career URL patterns for a company domain. */
export async function resolveCareerUrl(
  domain: string,
  existingUrl?: string | null,
): Promise<CareerResolveResult> {
  const tried: string[] = [];
  if (existingUrl?.trim()) {
    tried.push(existingUrl.trim());
    const detection = await detectPortal(existingUrl.trim());
    if (detection.confidence !== "low" || detection.portalType !== "unknown") {
      return {
        careerUrl: detection.careerUrl || existingUrl.trim(),
        tried,
        portalType: detection.portalType,
        confidence: detection.confidence,
        evidence: detection.evidence,
      };
    }
  }

  for (const url of candidateUrls(domain)) {
    tried.push(url);
    const probe = await probeUrl(url);
    if (!probe) continue;
    const detection = await detectPortal(probe.finalUrl);
    const looksUseful =
      detection.portalType !== "unknown" ||
      detection.evidence.includes("job_link_patterns") ||
      /career|job|workday|greenhouse|lever|ashby|workable/i.test(probe.finalUrl);
    if (!looksUseful) continue;
    return {
      careerUrl: detection.careerUrl || probe.finalUrl,
      tried,
      portalType: detection.portalType,
      confidence: detection.confidence,
      evidence: detection.evidence,
    };
  }

  return { careerUrl: null, tried };
}
