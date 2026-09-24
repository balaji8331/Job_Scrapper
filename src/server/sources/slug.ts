import { FOCUS_CITIES } from "@/lib/constants";
import type { CompanyConfig } from "./portal-types";

export function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "company";
}

export function companyNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    // careers.wipro.com → wipro; boards.greenhouse.io/foo handled by caller
    const skip = new Set([
      "careers",
      "jobs",
      "career",
      "apply",
      "boards",
      "api",
      "www",
      "myworkdayjobs",
      "successfactors",
      "oraclecloud",
      "greenhouse",
      "lever",
      "ashbyhq",
      "workable",
    ]);
    const meaningful = parts.find((part) => !skip.has(part) && part.length > 1);
    const raw = meaningful ?? parts[0] ?? "company";
    return raw
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return "Company";
  }
}

export function configFromCareerUrl(input: {
  careerUrl: string;
  name?: string;
  slug?: string;
  preferredCities?: string[];
}): CompanyConfig {
  const career_url = input.careerUrl.trim();
  const name = input.name?.trim() || companyNameFromUrl(career_url);
  const slug = input.slug?.trim() || slugifyName(name);
  return {
    name,
    slug,
    career_url,
    country: "India",
    preferred_cities: input.preferredCities?.length
      ? input.preferredCities
      : [...FOCUS_CITIES],
    preferred_roles: ["Software Engineer", "Backend Engineer", "Full Stack"],
    job_link_patterns: [],
  };
}
