import { readFileSync } from "fs";
import path from "path";
import { FOCUS_CITIES } from "@/lib/constants";
import type { CompanyConfig } from "./portal-types";
import { slugifyName } from "./slug";

export interface IndiaCompanySeed {
  name: string;
  slug: string;
  domain: string;
  career_url?: string;
  preferred_cities?: string[];
  ats_slug?: string;
  portal_hint?: string;
  notes?: string;
}

let cached: IndiaCompanySeed[] | null = null;

export function loadIndiaCompanySeed(): IndiaCompanySeed[] {
  if (cached) return cached;
  const file = path.join(process.cwd(), "src/server/sources/seeds/india-companies.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as IndiaCompanySeed[];
  cached = raw.map((row) => ({
    ...row,
    slug: row.slug || slugifyName(row.name),
    preferred_cities: row.preferred_cities?.length
      ? row.preferred_cities
      : [...FOCUS_CITIES],
  }));
  return cached;
}

export function seedToConfig(row: IndiaCompanySeed): CompanyConfig {
  return {
    name: row.name,
    slug: row.slug,
    career_url: row.career_url?.trim() || "",
    country: "India",
    preferred_cities: row.preferred_cities?.length
      ? row.preferred_cities
      : [...FOCUS_CITIES],
    preferred_roles: ["Software Engineer", "Backend Engineer", "Full Stack"],
    job_link_patterns: [],
    portal_hints: row.portal_hint ? [row.portal_hint] : [],
  };
}
