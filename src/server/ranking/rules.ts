import { LEVEL_TITLE_HINTS, MATCH_THRESHOLD } from "@/lib/constants";
import { tokenize } from "@/lib/text";
import type {
  ExperienceLevel,
  JobScore,
  NormalizedJob,
  Profile,
} from "@/lib/types";

const STOP = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "that",
  "this",
  "you",
  "our",
  "are",
  "job",
  "role",
  "team",
  "work",
  "will",
  "have",
  "plus",
  "using",
]);

function haystack(job: NormalizedJob): string {
  return `${job.title} ${job.location} ${job.tags.join(" ")} ${job.description}`.toLowerCase();
}

export function detectPostedLevel(job: NormalizedJob): ExperienceLevel | null {
  const text = haystack(job);
  const order: ExperienceLevel[] = ["lead", "senior", "fresher", "junior", "mid"];
  for (const level of order) {
    if (LEVEL_TITLE_HINTS[level].some((hint) => text.includes(hint))) return level;
  }
  return null;
}

export function levelFits(job: NormalizedJob, target: ExperienceLevel): boolean {
  const posted = detectPostedLevel(job);
  if (!posted) return true;
  const rank: Record<ExperienceLevel, number> = {
    fresher: 0,
    junior: 1,
    mid: 2,
    senior: 3,
    lead: 4,
  };
  return Math.abs(rank[posted] - rank[target]) <= 1;
}

export function scoreJob(
  job: NormalizedJob,
  queryRole: string,
  level: ExperienceLevel,
  profile: Profile | null,
): JobScore {
  const text = haystack(job);
  const roleTokens = tokenize(queryRole).filter((token) => !STOP.has(token));
  const titleTokens = tokenize(job.title);
  const roleHits = roleTokens.filter(
    (token) => job.title.toLowerCase().includes(token) || text.includes(token),
  );
  const titleOverlap = roleHits.length / Math.max(roleTokens.length, 1);

  const skills = profile?.skills ?? [];
  const skillOverlap = skills.filter((skill) =>
    text.includes(skill.toLowerCase()),
  );
  const missingSkills = skills
    .filter((skill) => !text.includes(skill.toLowerCase()))
    .slice(0, 8);
  const skillScore =
    skills.length === 0 ? 0.45 : skillOverlap.length / Math.max(skills.length, 1);

  const fit = levelFits(job, level);
  const posted = detectPostedLevel(job);
  const exactLevel =
    posted === level || titleTokens.some((token) => LEVEL_TITLE_HINTS[level].includes(token));

  let score = Math.round(
    titleOverlap * 40 + skillScore * 35 + (fit ? 15 : 0) + (exactLevel ? 10 : 0),
  );
  if (!fit) score = Math.min(score, MATCH_THRESHOLD - 1);
  score = Math.max(0, Math.min(100, score));

  const why: string[] = [];
  if (titleOverlap > 0.4) why.push("Title matches your target role");
  if (skillOverlap.length) why.push(`Skills: ${skillOverlap.slice(0, 4).join(", ")}`);
  if (fit) why.push("Seniority is in range");
  else why.push("Seniority looks off — skipped from today's 40");
  if (job.remote) why.push("Remote-friendly");

  return {
    score,
    levelFit: fit,
    skillOverlap,
    missingSkills,
    rationale: why.join(". ") || "Keyword match on role and location.",
  };
}
