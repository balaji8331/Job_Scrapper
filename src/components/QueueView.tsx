"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { EmptyState, Notice, ScorePill, Stat } from "@/components/ui/bits";
import {
  BoltIcon,
  BuildingIcon,
  CheckIcon,
  ExternalIcon,
  FileIcon,
  InboxIcon,
  LayersIcon,
  LinkIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SkipIcon,
  TargetIcon,
} from "@/components/ui/icons";
import { FOCUS_CITIES, INDIA_CITIES, LEVEL_LABELS } from "@/lib/constants";
import { EXPERIENCE_LEVELS, type ExperienceLevel, type QueueJob } from "@/lib/types";

type Tab = "queued" | "crawler" | "saved" | "applied";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "queued", label: "To apply" },
  { id: "crawler", label: "Company crawl" },
  { id: "saved", label: "Skipped" },
  { id: "applied", label: "Applied" },
];

export function QueueView() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [role, setRole] = useState("Backend Engineer");
  const [level, setLevel] = useState<ExperienceLevel>("mid");
  const [location, setLocation] = useState("Bengaluru");
  const [remoteOk, setRemoteOk] = useState(true);
  const [importUrl, setImportUrl] = useState("");
  const [tab, setTab] = useState<Tab>(
    initialTab === "crawler" ||
      initialTab === "saved" ||
      initialTab === "applied" ||
      initialTab === "queued"
      ? initialTab
      : "queued",
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [crawlerJobs, setCrawlerJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState({ date: "", queued: 0, applied: 0, target: 40 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    try {
      const response = await fetch("/api/queue");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load today's queue");
      setJobs(data.jobs ?? []);
      setCrawlerJobs(data.crawlerJobs ?? []);
      if (data.stats) setStats(data.stats);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load today's queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadQueue();
    })();
  }, [loadQueue]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage(
      `Searching India roles across ${FOCUS_CITIES.join(", ")}. This can take up to a minute.`,
    );
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      const sources = Object.entries((data.sourceCounts ?? {}) as Record<string, number>)
        .filter(([, count]) => count > 0)
        .map(([key, count]) => `${key} ${count}`)
        .join(" · ");
      setMessage(
        `Found ${data.found ?? 0} listings and queued ${data.queued ?? 0} for today.${
          sources ? ` Sources: ${sources}.` : ""
        }`,
      );
      await loadQueue();
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Search failed");
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      setImportUrl("");
      setMessage("Imported into today's queue.");
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(job: QueueJob, status: "applied" | "saved" | "queued") {
    if (!job.applicationId) return;
    await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: job.applicationId, status }),
    });
    await loadQueue();
  }

  async function addToToday(job: QueueJob) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add to today's queue");
      setMessage(`Added ${job.title} at ${job.company} to today's queue.`);
      setTab("queued");
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to today's queue");
    } finally {
      setBusy(false);
    }
  }

  async function generateResume(job: QueueJob) {
    setBusy(true);
    setError("");
    setMessage(`Writing a tailored resume for ${job.company}…`);
    try {
      const response = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Resume failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${job.company}-${job.title}.pdf`.replace(/\s+/g, "-");
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Resume downloaded. Apply on the company site, then mark it applied.");
      await loadQueue();
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setBusy(false);
    }
  }

  const buckets = useMemo(() => {
    return {
      queued: jobs.filter((job) => job.status === "queued"),
      crawler: crawlerJobs,
      saved: jobs.filter((job) => job.status === "saved"),
      applied: jobs.filter((job) => job.status === "applied"),
    } satisfies Record<Tab, QueueJob[]>;
  }, [jobs, crawlerJobs]);

  const visible = buckets[tab];
  const remaining = Math.max(0, stats.target - stats.applied);
  const crawlerFresh = crawlerJobs.filter(
    (job) => !jobs.some((row) => row.id === job.id && row.status === "queued"),
  ).length;

  return (
    <>
      <PageHeader
        title="Today's queue"
        description="Ranked India-only roles. Review each one, generate a tailored resume, then apply yourself."
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void loadQueue()}
              disabled={busy}
            >
              <RefreshIcon />
              Refresh
            </button>
            <button
              type="submit"
              form="queue-search"
              className="btn btn-primary"
              disabled={busy}
            >
              <BoltIcon />
              {busy ? "Working…" : `Build today's ${stats.target}`}
            </button>
          </>
        }
      />

      <div className="page space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Applied today"
            value={`${stats.applied} / ${stats.target}`}
            icon={<CheckIcon />}
            tone="emerald"
            progress={(stats.applied / stats.target) * 100}
            foot={`${remaining} still to go`}
          />
          <Stat
            label="Waiting on you"
            value={buckets.queued.length}
            icon={<LayersIcon />}
            tone="primary"
            foot="Open roles in today's queue"
          />
          <Stat
            label="Company crawl"
            value={crawlerFresh}
            icon={<BuildingIcon />}
            tone="violet"
            foot="Saved from Sources — not in To apply yet"
          />
          <Stat
            label="Strong matches"
            value={buckets.queued.filter((job) => job.score >= 70).length}
            icon={<TargetIcon />}
            tone="sky"
            foot="Score 70 or above"
          />
        </div>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="h2">Search filters</h2>
              <p className="tiny mt-0.5">
                Adzuna, company ATS boards, and the Playwright crawler — all restricted to India.
              </p>
            </div>
          </div>
          <form id="queue-search" onSubmit={search} className="card-pad grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="label" htmlFor="q-role">
                Role
              </label>
              <input
                id="q-role"
                className="input"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="Backend Engineer"
                required
              />
            </div>
            <div className="md:col-span-3">
              <label className="label" htmlFor="q-level">
                Experience level
              </label>
              <select
                id="q-level"
                className="select"
                value={level}
                onChange={(event) => setLevel(event.target.value as ExperienceLevel)}
              >
                {EXPERIENCE_LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {LEVEL_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label" htmlFor="q-city">
                City
              </label>
              <input
                id="q-city"
                className="input"
                list="india-cities"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
              <datalist id="india-cities">
                {INDIA_CITIES.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>
            <div className="flex items-end md:col-span-2">
              <label className="check pb-2">
                <input
                  type="checkbox"
                  checked={remoteOk}
                  onChange={(event) => setRemoteOk(event.target.checked)}
                />
                Remote OK
              </label>
            </div>
          </form>
          <div className="card-pad border-t border-[var(--line)]">
            <form onSubmit={importJob} className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1"
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                placeholder="Paste a Naukri or company career URL to add it to today's queue"
              />
              <button type="submit" className="btn btn-ghost" disabled={busy}>
                <LinkIcon />
                Import link
              </button>
            </form>
          </div>
        </section>

        {error ? <Notice kind="error">{error}</Notice> : null}
        {message && !error ? <Notice kind="info">{message}</Notice> : null}

        <section className="card">
          <div className="card-head">
            <div className="flex items-center gap-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`btn btn-sm ${tab === item.id ? "btn-dark" : "btn-quiet"}`}
                >
                  {item.label}
                  <span className="opacity-60">{buckets[item.id].length}</span>
                </button>
              ))}
            </div>
            <span className="tiny">
              {tab === "crawler"
                ? "From Sources → Crawl — separate from the ranked daily queue"
                : stats.date
                  ? `Queue for ${stats.date}`
                  : null}
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={
                tab === "crawler" ? (
                  <BuildingIcon />
                ) : tab === "queued" ? (
                  <SearchIcon />
                ) : (
                  <InboxIcon />
                )
              }
              title={
                tab === "queued"
                  ? "Nothing queued yet"
                  : tab === "crawler"
                    ? "No crawled company roles yet"
                    : tab === "saved"
                      ? "No skipped roles"
                      : "Nothing applied today"
              }
              hint={
                tab === "queued"
                  ? "Fill in your profile, set a role above, then build today's queue — or add roles from Company crawl."
                  : tab === "crawler"
                    ? "Open Sources, crawl a company (Accenture, Capgemini, …). Results land here, not in To apply."
                    : undefined
              }
            />
          ) : (
            <div className="divide-rows">
              {visible.map((job) => {
                const open = expanded === job.id;
                const isCrawlerTab = tab === "crawler";
                const alreadyQueued =
                  jobs.some((row) => row.id === job.id && row.status === "queued");
                return (
                  <article key={job.id} className="job">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="job-co">{job.company}</span>
                          <span className="chip">{job.source}</span>
                          {isCrawlerTab && alreadyQueued ? (
                            <span className="chip chip-emerald">In today&apos;s queue</span>
                          ) : null}
                          {job.remote ? <span className="chip chip-sky">Remote</span> : null}
                          {!isCrawlerTab && job.levelFit ? (
                            <span className="chip chip-emerald">Level fit</span>
                          ) : null}
                        </div>
                        <h3 className="job-title mt-1">{job.title}</h3>
                        <p className="meta mt-0.5">
                          {job.location || "India"}
                          {job.salary ? ` · ${job.salary}` : ""}
                        </p>
                        <p className="job-why">{job.rationale}</p>
                        {job.skillOverlap.length ? (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {job.skillOverlap.slice(0, 8).map((skill) => (
                              <span key={skill} className="chip chip-primary">
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {!isCrawlerTab || job.score > 0 ? <ScorePill score={job.score} /> : null}
                    </div>

                    <div className="actions">
                      {isCrawlerTab && !alreadyQueued ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => addToToday(job)}
                        >
                          <PlusIcon />
                          Add to today&apos;s queue
                        </button>
                      ) : null}
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`btn btn-sm ${isCrawlerTab && !alreadyQueued ? "btn-ghost" : "btn-primary"}`}
                      >
                        <ExternalIcon />
                        Open apply page
                      </a>
                      {!isCrawlerTab || alreadyQueued || job.applicationId ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => generateResume(job)}
                        >
                          <FileIcon />
                          {job.hasResume ? "Regenerate resume" : "Tailor resume"}
                        </button>
                      ) : null}
                      {!isCrawlerTab && job.status !== "applied" && job.applicationId ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setStatus(job, "applied")}
                        >
                          <CheckIcon />
                          Mark applied
                        </button>
                      ) : null}
                      {!isCrawlerTab && job.status === "queued" ? (
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          onClick={() => setStatus(job, "saved")}
                        >
                          <SkipIcon />
                          Skip
                        </button>
                      ) : null}
                      {!isCrawlerTab && job.status === "saved" ? (
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          onClick={() => setStatus(job, "queued")}
                        >
                          Put back
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm ml-auto"
                        onClick={() => setExpanded(open ? null : job.id)}
                      >
                        {open ? "Hide details" : "Details"}
                      </button>
                    </div>

                    {open ? (
                      <div className="panel mt-3 p-3">
                        {job.missingSkills.length ? (
                          <p className="text-[12.5px] text-[var(--text-2)]">
                            <span className="font-medium text-[var(--text)]">Gaps to address:</span>{" "}
                            {job.missingSkills.join(", ")}
                          </p>
                        ) : null}
                        {job.tags.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {job.tags.slice(0, 12).map((tag) => (
                              <span key={tag} className="chip">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--text-2)]">
                          {job.description?.slice(0, 2400) || "No description captured."}
                        </p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
