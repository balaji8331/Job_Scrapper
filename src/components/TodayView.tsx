"use client";

import { useEffect, useMemo, useState } from "react";
import { INDIA_CITIES, LEVEL_LABELS } from "@/lib/constants";
import { EXPERIENCE_LEVELS, type ExperienceLevel, type QueueJob } from "@/lib/types";

interface QueueResponse {
  jobs?: QueueJob[];
  stats?: { date: string; queued: number; applied: number; target: number };
  error?: string;
}

interface Health {
  supabase: boolean;
  adzuna: boolean;
  gemini: boolean;
  jsearch: boolean;
}

export function TodayView() {
  const [role, setRole] = useState("Backend Engineer");
  const [level, setLevel] = useState<ExperienceLevel>("mid");
  const [location, setLocation] = useState("Bengaluru");
  const [remoteOk, setRemoteOk] = useState(true);
  const [importUrl, setImportUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState({ date: "", queued: 0, applied: 0, target: 40 });
  const [health, setHealth] = useState<Health | null>(null);

  async function loadQueue() {
    const response = await fetch("/api/queue");
    const data = (await response.json()) as QueueResponse;
    if (!response.ok) {
      setMessage(data.error || "Could not load today's queue");
      return;
    }
    setJobs(data.jobs ?? []);
    if (data.stats) setStats(data.stats);
  }

  useEffect(() => {
    let alive = true;
    fetch("/api/queue")
      .then(async (response) => {
        const data = (await response.json()) as QueueResponse;
        if (!alive) return;
        if (!response.ok) {
          setMessage(data.error || "Could not load today's queue");
          return;
        }
        setJobs(data.jobs ?? []);
        if (data.stats) setStats(data.stats);
      })
      .catch(() => {
        if (alive) setMessage("Could not load today's queue");
      });
    fetch("/api/health")
      .then((res) => res.json())
      .then((value: Health) => {
        if (alive) setHealth(value);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  const remaining = Math.max(0, stats.target - stats.applied);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("Searching India boards… this can take up to a minute.");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          level,
          location,
          remoteOk,
          cities: location ? [location] : [...INDIA_CITIES],
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        found?: number;
        queued?: number;
        sourceCounts?: Record<string, number>;
      };
      if (!response.ok) throw new Error(data.error || "Search failed");
      const sources = Object.entries(data.sourceCounts ?? {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(" · ");
      setMessage(
        `Found ${data.found ?? 0} listings, queued ${data.queued ?? 0} for today. ${sources}`,
      );
      await loadQueue();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function importJob(event: React.FormEvent) {
    event.preventDefault();
    if (!importUrl.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl, title: role, location }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Import failed");
      setImportUrl("");
      setMessage("Imported into today's queue.");
      await loadQueue();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function markApplied(job: QueueJob) {
    if (!job.applicationId) return;
    await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: job.applicationId, status: "applied" }),
    });
    await loadQueue();
  }

  async function skipJob(job: QueueJob) {
    if (!job.applicationId) return;
    await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: job.applicationId, status: "saved" }),
    });
    await loadQueue();
  }

  async function generateResume(job: QueueJob) {
    setBusy(true);
    setMessage(`Writing a tailored resume for ${job.company}…`);
    try {
      const response = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Resume failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${job.company}-${job.title}.pdf`.replace(/\s+/g, "-");
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Resume downloaded. Apply on the company site, then mark Applied.");
      await loadQueue();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Resume failed");
    } finally {
      setBusy(false);
    }
  }

  const queued = useMemo(
    () => jobs.filter((job) => job.status === "queued"),
    [jobs],
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Applied today" value={`${stats.applied} / ${stats.target}`} />
        <Stat label="Still to apply" value={`${remaining}`} />
        <Stat label="In today's queue" value={`${queued.length}`} />
      </section>

      {health && !health.supabase ? (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          Add Supabase keys in <code>.env.local</code> (see <code>.env.example</code>), then
          run the SQL in <code>supabase/migrations/001_init.sql</code>.
        </p>
      ) : null}

      <form
        onSubmit={search}
        className="grid gap-3 rounded-2xl border border-line bg-card p-4 md:grid-cols-12"
      >
        <label className="md:col-span-4">
          <span className="mb-1 block text-xs text-muted">Role</span>
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-lg border border-line bg-background px-3 py-2"
            placeholder="Backend Engineer"
            required
          />
        </label>
        <label className="md:col-span-3">
          <span className="mb-1 block text-xs text-muted">Level</span>
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value as ExperienceLevel)}
            className="w-full rounded-lg border border-line bg-background px-3 py-2"
          >
            {EXPERIENCE_LEVELS.map((item) => (
              <option key={item} value={item}>
                {LEVEL_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-3">
          <span className="mb-1 block text-xs text-muted">City</span>
          <input
            list="india-cities"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="w-full rounded-lg border border-line bg-background px-3 py-2"
          />
          <datalist id="india-cities">
            {INDIA_CITIES.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={remoteOk}
            onChange={(event) => setRemoteOk(event.target.checked)}
          />
          Remote OK
        </label>
        <div className="md:col-span-12">
          <button
            disabled={busy}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background disabled:opacity-60"
          >
            {busy ? "Working…" : "Build today's 40"}
          </button>
        </div>
      </form>

      <form onSubmit={importJob} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={importUrl}
          onChange={(event) => setImportUrl(event.target.value)}
          placeholder="Paste a Naukri / company career URL into today's queue"
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2"
        />
        <button
          disabled={busy}
          className="rounded-full border border-line px-4 py-2 text-sm"
        >
          Import link
        </button>
      </form>

      {message ? <p className="text-sm text-muted">{message}</p> : null}

      {health ? (
        <p className="text-xs text-muted">
          Sources: Adzuna {health.adzuna ? "on" : "off"} · Gemini{" "}
          {health.gemini ? "on" : "rules only"} · JSearch {health.jsearch ? "on" : "off"} ·
          company portals always on
        </p>
      ) : null}

      <div className="space-y-3">
        {queued.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-muted">
            No ranked jobs yet. Fill your profile, then build today&apos;s queue.
          </p>
        ) : (
          queued.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-line bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {job.company} · {job.source}
                  </p>
                  <h2 className="text-lg font-semibold">{job.title}</h2>
                  <p className="text-sm text-muted">
                    {job.location || "India"}
                    {job.remote ? " · Remote" : ""}
                    {job.salary ? ` · ${job.salary}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-accent/15 px-3 py-1 text-sm text-accent">
                  {job.score}% match
                </span>
              </div>
              <p className="mt-3 text-sm text-muted">{job.rationale}</p>
              {job.skillOverlap.length ? (
                <p className="mt-2 text-xs text-accent">
                  Overlap: {job.skillOverlap.slice(0, 8).join(", ")}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background"
                >
                  Open apply link
                </a>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => generateResume(job)}
                  className="rounded-full border border-accent px-4 py-1.5 text-sm text-accent"
                >
                  {job.hasResume ? "Regenerate resume" : "Generate resume"}
                </button>
                <button
                  type="button"
                  onClick={() => markApplied(job)}
                  className="rounded-full border border-line px-4 py-1.5 text-sm"
                >
                  Mark applied
                </button>
                <button
                  type="button"
                  onClick={() => skipJob(job)}
                  className="rounded-full px-4 py-1.5 text-sm text-muted"
                >
                  Skip
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
