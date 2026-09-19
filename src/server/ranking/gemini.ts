import type { JobScore, NormalizedJob, Profile } from "@/lib/types";

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

interface GeminiBatchItem {
  index: number;
  score: number;
  levelFit: boolean;
  missingSkills: string[];
  rationale: string;
}

async function generate(model: string, prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function generateWithFallback(prompt: string): Promise<string | null> {
  for (const model of MODEL_CANDIDATES) {
    try {
      const text = await generate(model, prompt);
      if (text) return text;
    } catch {
      continue;
    }
  }
  return null;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{") >= 0 ? raw.indexOf("{") : raw.indexOf("[");
    const end = raw.lastIndexOf("}") >= 0 ? raw.lastIndexOf("}") + 1 : raw.lastIndexOf("]") + 1;
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end)) as T;
    } catch {
      return null;
    }
  }
}

export async function geminiRescore(
  jobs: Array<{ job: NormalizedJob; base: JobScore }>,
  role: string,
  level: string,
  profile: Profile | null,
): Promise<Map<string, JobScore>> {
  const updated = new Map<string, JobScore>();
  if (!process.env.GEMINI_API_KEY || jobs.length === 0) return updated;

  const batchSize = 8;
  for (let i = 0; i < jobs.length; i += batchSize) {
    const slice = jobs.slice(i, i + batchSize);
    const prompt = `You rank India software/job listings for a candidate. Return JSON: {"items":[{"index":0,"score":0-100,"levelFit":true,"missingSkills":[],"rationale":"max 2 sentences"}]}.
Target role: ${role}
Target level: ${level}
Candidate skills: ${(profile?.skills ?? []).join(", ") || "unknown"}
Candidate summary: ${(profile?.summary ?? "").slice(0, 400)}
Jobs:
${slice
  .map(
    ({ job, base }, index) =>
      `${index}. ${job.title} at ${job.company} [${job.location}] rulesScore=${base.score}
${job.description.slice(0, 500)}`,
  )
  .join("\n\n")}`;

    const parsed = parseJson<{ items?: GeminiBatchItem[] }>(
      await generateWithFallback(prompt),
    );
    for (const item of parsed?.items ?? []) {
      const row = slice[item.index];
      if (!row) continue;
      const key = `${row.job.source}:${row.job.externalId}`;
      updated.set(key, {
        score: Math.max(0, Math.min(100, Math.round(item.score))),
        levelFit: item.levelFit && row.base.levelFit,
        skillOverlap: row.base.skillOverlap,
        missingSkills: item.missingSkills?.length
          ? item.missingSkills.slice(0, 8)
          : row.base.missingSkills,
        rationale: item.rationale || row.base.rationale,
      });
    }
  }
  return updated;
}

export async function geminiTailor(input: {
  profile: Profile;
  job: { title: string; company: string; description: string };
}): Promise<{
  summary: string;
  skills: string[];
  experience: Array<{ company: string; title: string; bullets: string[] }>;
  coverLetter: string;
} | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const prompt = `Rewrite this resume for one India job. Return JSON:
{"summary":"3-4 lines","skills":["..."],"experience":[{"company":"","title":"","bullets":["..."]}],"coverLetter":"120-180 words, India English, no fluff"}
Keep facts truthful. Reorder and emphasize relevant bullets. Do not invent employers or degrees.
Job: ${input.job.title} at ${input.job.company}
Description: ${input.job.description.slice(0, 4000)}
Profile JSON: ${JSON.stringify({
    fullName: input.profile.fullName,
    summary: input.profile.summary,
    skills: input.profile.skills,
    experience: input.profile.experience,
    education: input.profile.education,
    projects: input.profile.projects,
    location: input.profile.location,
  })}`;
  return parseJson(await generateWithFallback(prompt));
}
