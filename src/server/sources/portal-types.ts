export const PORTAL_TYPES = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "workday",
  "successfactors",
  "taleo",
  "generic",
  "unknown",
] as const;

export type PortalType = (typeof PORTAL_TYPES)[number];

export interface CompanyFieldConfig {
  selectors: string[];
}

export interface CompanyConfig {
  name: string;
  slug: string;
  career_url: string;
  country: string;
  preferred_cities: string[];
  preferred_roles: string[];
  job_link_patterns: string[];
  pagination?: {
    type?: string;
    selector_text?: string;
  };
  portal_hints?: string[];
  fields?: {
    title?: CompanyFieldConfig;
    location?: CompanyFieldConfig;
    description?: CompanyFieldConfig;
  };
}

export interface PortalDetection {
  portalType: PortalType;
  atsSlug: string | null;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  careerUrl: string;
}

export interface CrawlerSourceRow {
  id: string;
  company_id: string;
  name: string;
  career_url: string;
  portal_type: PortalType;
  ats_slug: string | null;
  country: string;
  preferred_cities: string[];
  preferred_roles: string[];
  job_link_patterns: string[];
  config: Record<string, unknown>;
  discovery: Record<string, unknown>;
  active: boolean;
  last_detected_at: string | null;
  last_crawled_at: string | null;
}

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  country: string;
  career_url: string;
  active: boolean;
}
