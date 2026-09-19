export const EXPERIENCE_LEVELS = [
  "fresher",
  "junior",
  "mid",
  "senior",
  "lead",
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const JOB_SOURCES = [
  "adzuna",
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "jsearch",
  "import",
] as const;

export type JobSourceId = (typeof JOB_SOURCES)[number];

export const APPLICATION_STATUSES = [
  "saved",
  "queued",
  "applied",
  "interview",
  "rejected",
  "offer",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface JobSearchQuery {
  role: string;
  level: ExperienceLevel;
  location?: string;
  remoteOk?: boolean;
  cities?: string[];
}

export interface NormalizedJob {
  source: JobSourceId;
  externalId: string;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  description: string;
  salary?: string | null;
  postedAt?: string | null;
  remote: boolean;
  tags: string[];
}

export interface ExperienceItem {
  company: string;
  title: string;
  start: string;
  end: string;
  current?: boolean;
  bullets: string[];
}

export interface EducationItem {
  school: string;
  degree: string;
  year: string;
}

export interface ProjectItem {
  name: string;
  url?: string;
  bullets: string[];
}

export interface Profile {
  id?: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  summary: string;
  skills: string[];
  targetRoles: string[];
  cities: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
}

export interface JobScore {
  score: number;
  levelFit: boolean;
  skillOverlap: string[];
  missingSkills: string[];
  rationale: string;
}

export interface QueueJob {
  id: string;
  source: JobSourceId;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  description: string;
  salary: string | null;
  remote: boolean;
  tags: string[];
  score: number;
  levelFit: boolean;
  skillOverlap: string[];
  missingSkills: string[];
  rationale: string;
  status: ApplicationStatus;
  applicationId: string | null;
  hasResume: boolean;
  pdfPath: string | null;
}

export interface DailyStats {
  date: string;
  queued: number;
  applied: number;
  target: number;
}
