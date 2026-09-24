import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { crawlCompanySlug, crawlConfiguredCompanies } from "../src/server/crawler/run";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index);
      const value = trimmed.slice(index + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function patchPublicDns() {
  const require = createRequire(import.meta.url);
  require("../src/server/public-dns.cjs");
}

async function main() {
  loadEnvLocal();
  patchPublicDns();
  const args = process.argv.slice(2);
  const slugFlag = args.find((item) => item.startsWith("--slug="));
  const maxFlag = args.find((item) => item.startsWith("--max="));
  const slug = slugFlag?.split("=")[1];
  const maxJobs = maxFlag ? Number(maxFlag.split("=")[1]) : 20;

  if (slug) {
    const result = await crawlCompanySlug(slug, { maxJobs });
    console.log(JSON.stringify(result, null, 2));
    if (result.error) process.exitCode = 1;
    return;
  }

  const results = await crawlConfiguredCompanies(undefined, { maxJobs });
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
