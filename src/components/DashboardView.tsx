"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { EmptyState, Notice, ScorePill, SectionCard, Stat } from "@/components/ui/bits";
import {
  BoltIcon,
  BuildingIcon,
  CheckIcon,
  ExternalIcon,
  InboxIcon,
  LayersIcon,
  RefreshIcon,
  TargetIcon,
  TrendIcon,
  UserIcon,
} from "@/components/ui/icons";
import { FOCUS_CITIES } from "@/lib/constants";
import type { ApplicationStatus, DailyStats, Profile, QueueJob } from "@/lib/types";

type Health = {
  supabase: boolean;
  adzuna: boolean;
  gemini: boolean;
  jsearch: boolean;
};

type Application = {
  id: string;
  status: ApplicationStatus;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  appliedAt: string | null;
  queueDate: string | null;
};

const FUNNEL: Array<{ status: ApplicationStatus; label: string }> = [
  { status: "queued", label: "Queued" },
  { status: "applied", label: "Applied" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
];

export function DashboardView() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [queueRes, appsRes, profileRes, healthRes] = await Promise.all([
        fetch("/api/queue"),
        fetch("/api/applications"),
        fetch("/api/profile"),
        fetch("/api/health"),
      ]);

      const queueData = await queueRes.json();
      if (!queueRes.ok) throw new Error(queueData.error ?? "Failed to load queue");
      setJobs(queueData.jobs ?? []);
      setStats(queueData.stats ?? null);

      const appsData = await appsRes.json();
      if (appsRes.ok) setApplications(appsData.applications ?? []);

      const profileData = await profileRes.json();
      if (profileRes.ok) setProfile(profileData.profile ?? null);

      setHealth(await healthRes.json());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const counts = useMemo(() => {
    const map = new Map<ApplicationStatus, number>();
    for (const app of applications) {
      map.set(app.status, (map.get(app.status) ?? 0) + 1);
    }
    return map;
  }, [applications]);

  const target = stats?.target ?? 40;
  const appliedToday = stats?.applied ?? 0;
  const openToday = jobs.filter((job) => job.status === "queued" || job.status === "saved").length;
  const strongMatches = jobs.filter((job) => job.score >= 70).length;
  const topPicks = useMemo(() => jobs.slice(0, 5), [jobs]);
  const funnelMax = Math.max(1, ...FUNNEL.map((step) => counts.get(step.status) ?? 0));

  const setupGaps = useMemo(() => {
    const gaps: string[] = [];
    if (!profile?.fullName || !profile?.email) gaps.push("Add your name and email to the profile");
    if (!profile?.skills?.length) gaps.push("List your skills so jobs can be scored");
    if (!profile?.targetRoles?.length) gaps.push("Set at least one target role");
    if (!profile?.experience?.length) gaps.push("Add one experience entry for resume generation");
    return gaps;
  }, [profile]);

  const inPipeline = useMemo(
    () => applications.filter((app) => app.status !== "queued" && app.status !== "saved"),
    [applications],
  );

  const recent = useMemo(() => inPipeline.slice(0, 6), [inPipeline]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Daily progress across ${FOCUS_CITIES.join(", ")}. Everything here is India-only.`}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={refresh} disabled={loading}>
              <RefreshIcon className={loading ? "spin" : undefined} />
              Refresh
            </button>
            <Link href="/queue" className="btn btn-primary">
              <BoltIcon />
              Open today&apos;s queue
            </Link>
          </>
        }
      />

      <div className="page space-y-4">
        {error ? <Notice kind="error">{error}</Notice> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Applied today"
            value={appliedToday}
            icon={<CheckIcon />}
            tone="emerald"
            progress={(appliedToday / target) * 100}
            foot={`${Math.max(0, target - appliedToday)} left to hit ${target}`}
          />
          <Stat
            label="Open in queue"
            value={openToday}
            icon={<LayersIcon />}
            tone="primary"
            foot={`${jobs.length} ranked today`}
          />
          <Stat
            label="Strong matches"
            value={strongMatches}
            icon={<TargetIcon />}
            tone="sky"
            foot="Score 70 or above"
          />
          <Stat
            label="In pipeline"
            value={inPipeline.length}
            icon={<TrendIcon />}
            tone="violet"
            foot={`${counts.get("interview") ?? 0} interviews · ${counts.get("offer") ?? 0} offers`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <SectionCard
            title="Top picks for today"
            subtitle="Highest scoring roles from your ranked queue"
            action={
              <Link href="/queue" className="btn btn-quiet btn-sm">
                View all
              </Link>
            }
            flush
          >
            {loading && !topPicks.length ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-14 w-full" />
                ))}
              </div>
            ) : topPicks.length ? (
              <div className="divide-rows">
                {topPicks.map((job) => (
                  <div key={job.id} className="job flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="job-title truncate">{job.title}</p>
                      <p className="job-co">
                        {job.company} · {job.location || "India"}
                      </p>
                      {job.skillOverlap.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {job.skillOverlap.slice(0, 4).map((skill) => (
                            <span key={skill} className="chip">
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <ScorePill score={job.score} />
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        <ExternalIcon />
                        Open
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<InboxIcon />}
                title="No jobs ranked yet"
                hint="Run a search to build today's queue from Adzuna, company ATS boards, and the crawler."
                action={
                  <Link href="/queue" className="btn btn-primary btn-sm">
                    Build today&apos;s queue
                  </Link>
                }
              />
            )}
          </SectionCard>

          <div className="space-y-4">
            <SectionCard title="Pipeline" subtitle="All applications by stage">
              <div className="space-y-3">
                {FUNNEL.map((step) => {
                  const value = counts.get(step.status) ?? 0;
                  return (
                    <div key={step.status}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12.5px] text-[var(--text-2)]">{step.label}</span>
                        <span className="text-[13px] font-semibold">{value}</span>
                      </div>
                      <div className="bar">
                        <span style={{ width: `${(value / funnelMax) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                  <span className="tiny">Rejected</span>
                  <span className="chip chip-rose">{counts.get("rejected") ?? 0}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Connected sources"
              subtitle="Credentials detected in your environment"
              action={
                <Link href="/sources" className="btn btn-quiet btn-sm">
                  Manage
                </Link>
              }
            >
              <div className="space-y-2">
                {(
                  [
                    ["Supabase", health?.supabase, "Database, queue, and storage"],
                    ["Adzuna", health?.adzuna, "India job aggregator"],
                    ["Gemini", health?.gemini, "Resume tailoring"],
                    ["JSearch", health?.jsearch, "Fallback aggregator"],
                  ] as Array<[string, boolean | undefined, string]>
                ).map(([name, ok, hint]) => (
                  <div key={name} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium">{name}</p>
                      <p className="tiny">{hint}</p>
                    </div>
                    <span className={ok ? "chip chip-emerald" : "chip chip-amber"}>
                      <span className="dot" />
                      {ok ? "Ready" : "Missing key"}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            title="Recent activity"
            subtitle="Latest status changes in your tracker"
            action={
              <Link href="/tracker" className="btn btn-quiet btn-sm">
                Open pipeline
              </Link>
            }
            flush
          >
            {recent.length ? (
              <div className="divide-rows">
                {recent.map((app) => (
                  <div key={app.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{app.title}</p>
                      <p className="tiny truncate">
                        {app.company}
                        {app.location ? ` · ${app.location}` : ""}
                      </p>
                    </div>
                    <span className={`chip ${statusChip(app.status)}`}>{app.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<BuildingIcon />}
                title="Nothing applied yet"
                hint="Mark a job as applied from the queue and it will show up here."
              />
            )}
          </SectionCard>

          <SectionCard
            title="Setup checklist"
            subtitle="Complete these so scoring and resumes work well"
            action={
              <Link href="/profile" className="btn btn-quiet btn-sm">
                Edit profile
              </Link>
            }
          >
            {setupGaps.length ? (
              <ul className="space-y-2">
                {setupGaps.map((gap) => (
                  <li key={gap} className="flex items-start gap-2 text-[13px] text-[var(--text-2)]">
                    <span className="chip chip-amber mt-0.5">
                      <span className="dot" />
                    </span>
                    {gap}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 text-[13px] text-[var(--emerald)]">
                <UserIcon className="h-4 w-4" />
                Your profile has everything needed for scoring and resumes.
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function statusChip(status: ApplicationStatus) {
  switch (status) {
    case "applied":
      return "chip-sky";
    case "interview":
      return "chip-violet";
    case "offer":
      return "chip-emerald";
    case "rejected":
      return "chip-rose";
    default:
      return "";
  }
}
