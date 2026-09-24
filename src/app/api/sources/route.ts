import { NextResponse } from "next/server";
import {
  addCompanyFromCareerUrl,
  detectAllConfiguredPortals,
  detectAndPersistPortal,
  getSourcesOverview,
  resolveMissingCareerUrls,
  syncIndiaSeedToSupabase,
  syncYamlConfigsToSupabase,
} from "@/server/db/companies";
import { crawlCompanySlug } from "@/server/crawler/run";
import { jsonError, requireSupabase } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  try {
    const data = await getSourcesOverview();
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to list sources", 500);
  }
}

export async function POST(request: Request) {
  const blocked = requireSupabase();
  if (blocked) return blocked;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?:
        | "sync"
        | "seed"
        | "resolve"
        | "add-url"
        | "detect"
        | "detect-all";
      slug?: string;
      careerUrl?: string;
      name?: string;
      crawl?: boolean;
      limit?: number;
    };
    const action = body.action ?? "detect-all";

    if (action === "sync") {
      const result = await syncYamlConfigsToSupabase();
      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === "seed") {
      const result = await syncIndiaSeedToSupabase();
      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === "resolve") {
      const result = await resolveMissingCareerUrls({ limit: body.limit ?? 15 });
      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === "add-url") {
      const careerUrl = body.careerUrl?.trim();
      if (!careerUrl) return jsonError("careerUrl is required");
      const added = await addCompanyFromCareerUrl({
        careerUrl,
        name: body.name,
      });
      let crawl = null;
      if (body.crawl !== false) {
        crawl = await crawlCompanySlug(added.company.slug, { maxJobs: 20 });
      }
      return NextResponse.json({
        ok: true,
        action,
        company: added.company,
        source: added.source,
        portalType: added.detection.portalType,
        connector: added.connector,
        confidence: added.detection.confidence,
        crawl,
      });
    }

    if (action === "detect") {
      const slug = body.slug?.trim();
      if (!slug) return jsonError("slug is required for detect");
      const result = await detectAndPersistPortal(slug);
      return NextResponse.json({
        ok: true,
        action,
        slug,
        portalType: result.detection.portalType,
        connector: result.connector,
        confidence: result.detection.confidence,
        atsSlug: result.detection.atsSlug,
        evidence: result.detection.evidence,
        source: result.source,
      });
    }

    const results = await detectAllConfiguredPortals();
    return NextResponse.json({
      ok: true,
      action: "detect-all",
      count: results.length,
      results: results.map((row) => ({
        slug: row.config.slug,
        name: row.config.name,
        portalType: row.detection.portalType,
        connector: row.connector,
        confidence: row.detection.confidence,
        atsSlug: row.detection.atsSlug,
        evidence: row.detection.evidence,
      })),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Source detection failed", 500);
  }
}
