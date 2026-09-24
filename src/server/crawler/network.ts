import type { Page, Response } from "playwright";

export interface CapturedJson {
  url: string;
  status: number;
  data: unknown;
}

const JOB_KEYWORDS = [
  "job",
  "jobs",
  "career",
  "requisition",
  "opening",
  "opportunity",
  "position",
  "search",
  "posting",
  "findjobs",
  "elastic",
  "jobmap",
];

export function attachJsonCapture(page: Page): CapturedJson[] {
  const responses: CapturedJson[] = [];

  page.on("response", (response: Response) => {
    void (async () => {
      const contentType = (response.headers()["content-type"] || "").toLowerCase();
      if (!contentType.includes("application/json")) return;
      const url = response.url().toLowerCase();
      if (!JOB_KEYWORDS.some((keyword) => url.includes(keyword))) return;
      try {
        const data = await response.json();
        responses.push({
          url: response.url(),
          status: response.status(),
          data,
        });
      } catch {
        /* ignore non-json bodies */
      }
    })();
  });

  return responses;
}
