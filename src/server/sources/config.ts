import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { CompanyConfig } from "./portal-types";

const CONFIG_DIR = path.join(process.cwd(), "src/server/sources/configs");

function isCompanyConfig(value: unknown): value is CompanyConfig {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === "string" &&
    typeof row.slug === "string" &&
    typeof row.career_url === "string"
  );
}

export function listCompanyConfigFiles(): string[] {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs
    .readdirSync(CONFIG_DIR)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort();
}

export function loadCompanyConfig(slugOrFile: string): CompanyConfig | null {
  const fileName = slugOrFile.endsWith(".yaml") || slugOrFile.endsWith(".yml")
    ? slugOrFile
    : `${slugOrFile}.yaml`;
  const filePath = path.join(CONFIG_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed: unknown = parseYaml(raw);
  if (!isCompanyConfig(parsed)) return null;
  return {
    ...parsed,
    country: parsed.country || "India",
    preferred_cities: parsed.preferred_cities ?? ["Bengaluru", "Hyderabad", "Chennai"],
    preferred_roles: parsed.preferred_roles ?? [],
    job_link_patterns: parsed.job_link_patterns ?? [],
  };
}

export function loadAllCompanyConfigs(): CompanyConfig[] {
  return listCompanyConfigFiles()
    .map((file) => loadCompanyConfig(file))
    .filter((config): config is CompanyConfig => Boolean(config));
}
