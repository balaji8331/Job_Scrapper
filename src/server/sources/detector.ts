import type { PortalDetection, PortalType } from "./portal-types";

interface Fingerprint {
  portalType: PortalType;
  patterns: RegExp[];
  slugFrom?: RegExp;
  confidence: "high" | "medium";
}

const FINGERPRINTS: Fingerprint[] = [
  {
    portalType: "greenhouse",
    patterns: [
      /boards(?:-api)?\.greenhouse\.io/i,
      /greenhouse\.io\/embed/i,
      /grnh\.se\//i,
    ],
    slugFrom: /boards(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/)?([a-z0-9-_]+)/i,
    confidence: "high",
  },
  {
    portalType: "lever",
    patterns: [/api\.lever\.co/i, /jobs\.lever\.co/i, /lever\.co\/embed/i],
    slugFrom: /(?:api|jobs)\.lever\.co\/(?:v0\/postings\/)?([a-z0-9-_]+)/i,
    confidence: "high",
  },
  {
    portalType: "ashby",
    patterns: [/api\.ashbyhq\.com/i, /jobs\.ashbyhq\.com/i, /ashbyhq\.com/i],
    slugFrom: /(?:api|jobs)\.ashbyhq\.com\/(?:posting-api\/job-board\/)?([a-z0-9-_]+)/i,
    confidence: "high",
  },
  {
    portalType: "workable",
    patterns: [/apply\.workable\.com/i, /workable\.com\/jobs/i, /workable\.com\/api/i],
    slugFrom: /apply\.workable\.com\/(?:api\/v1\/widget\/accounts\/)?([a-z0-9-_]+)/i,
    confidence: "high",
  },
  {
    portalType: "workday",
    patterns: [/myworkdayjobs\.com/i, /workday\.com/i, /wd\d+\.myworkdayjobs\.com/i],
    confidence: "high",
  },
  {
    portalType: "successfactors",
    patterns: [/successfactors\.com/i, /sapsf\.com/i, /career.*successfactors/i],
    confidence: "medium",
  },
  {
    portalType: "taleo",
    patterns: [/taleo\.net/i, /oraclecloud\.com\/.*taleo/i],
    confidence: "medium",
  },
];

async function fetchCareerHtml(url: string): Promise<{ finalUrl: string; html: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "IndiaJobOS/1.0 (portal detector; personal job search)",
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    return { finalUrl: response.url || url, html };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function matchFingerprints(haystack: string): PortalDetection | null {
  for (const fingerprint of FINGERPRINTS) {
    if (!fingerprint.patterns.some((pattern) => pattern.test(haystack))) continue;
    const slugMatch = fingerprint.slugFrom?.exec(haystack);
    return {
      portalType: fingerprint.portalType,
      atsSlug: slugMatch?.[1] ?? null,
      confidence: fingerprint.confidence,
      evidence: fingerprint.patterns
        .filter((pattern) => pattern.test(haystack))
        .map((pattern) => pattern.source),
      careerUrl: "",
    };
  }
  return null;
}

export async function detectPortal(careerUrl: string): Promise<PortalDetection> {
  const page = await fetchCareerHtml(careerUrl);
  if (!page) {
    return {
      portalType: "unknown",
      atsSlug: null,
      confidence: "low",
      evidence: ["fetch_failed"],
      careerUrl,
    };
  }

  const haystack = `${page.finalUrl}\n${page.html}`;
  const matched = matchFingerprints(haystack);
  if (matched) {
    return { ...matched, careerUrl: page.finalUrl };
  }

  const hasJobLinks =
    /href=["'][^"']*(?:\/jobs?\/|\/careers?\/|\/opportunities\/|\/requisition)/i.test(
      page.html,
    );
  return {
    portalType: hasJobLinks ? "generic" : "unknown",
    atsSlug: null,
    confidence: hasJobLinks ? "medium" : "low",
    evidence: hasJobLinks ? ["job_link_patterns"] : ["no_ats_fingerprint"],
    careerUrl: page.finalUrl,
  };
}

/** Maps portal type → connector id used by the source registry. */
export const SOURCE_REGISTRY: Record<
  PortalType,
  "greenhouse" | "lever" | "ashby" | "workable" | "generic" | "unknown"
> = {
  greenhouse: "greenhouse",
  lever: "lever",
  ashby: "ashby",
  workable: "workable",
  workday: "generic",
  successfactors: "generic",
  taleo: "generic",
  generic: "generic",
  unknown: "unknown",
};

export function resolveConnector(portalType: PortalType) {
  return SOURCE_REGISTRY[portalType];
}
