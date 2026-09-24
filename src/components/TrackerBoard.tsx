"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { EmptyState, Notice, Stat } from "@/components/ui/bits";
import {
  BoardIcon,
  CheckIcon,
  ExternalIcon,
  RefreshIcon,
  TrendIcon,
} from "@/components/ui/icons";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";

interface Row {
  id: string;
  status: ApplicationStatus;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  notes: string;
  appliedAt: string | null;
  queueDate: string | null;
  source: string;
}

const COLUMNS: Array<{ status: ApplicationStatus; label: string; color: string }> = [
  { status: "queued", label: "Queued", color: "var(--text-3)" },
  { status: "saved", label: "Saved", color: "var(--amber)" },
  { status: "applied", label: "Applied", color: "var(--sky)" },
  { status: "interview", label: "Interview", color: "var(--violet)" },
  { status: "offer", label: "Offer", color: "var(--emerald)" },
  { status: "rejected", label: "Rejected", color: "var(--rose)" },
];

export function TrackerBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/applications");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load tracker");
      setRows(data.applications ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracker");
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

  async function move(row: Row, status: ApplicationStatus) {
    setRows((current) =>
      current.map((item) => (item.id === row.id ? { ...item, status } : item)),
    );
    const response = await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: row.id, status }),
    });
    if (!response.ok) {
      setError("Could not update that application");
      await load();
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.title} ${row.company} ${row.location}`.toLowerCase().includes(needle),
    );
  }, [rows, query]);

  const grouped = useMemo(() => {
    const map = new Map<ApplicationStatus, Row[]>();
    for (const status of APPLICATION_STATUSES) map.set(status, []);
    for (const row of filtered) map.get(row.status)?.push(row);
    return map;
  }, [filtered]);

  const active = rows.filter((row) => row.status !== "queued" && row.status !== "saved").length;
  const interviews = rows.filter((row) => row.status === "interview").length;
  const offers = rows.filter((row) => row.status === "offer").length;
  const applied = rows.filter((row) => row.status === "applied").length;
  const rate = applied + interviews + offers > 0
    ? Math.round(((interviews + offers) / (applied + interviews + offers)) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Every application you have touched, grouped by stage. Change a stage from the dropdown on each card."
        actions={
          <button type="button" className="btn btn-ghost" onClick={refresh} disabled={loading}>
            <RefreshIcon className={loading ? "spin" : undefined} />
            Refresh
          </button>
        }
      />

      <div className="page space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Active applications" value={active} icon={<BoardIcon />} tone="primary" />
          <Stat label="Applied" value={applied} icon={<CheckIcon />} tone="sky" />
          <Stat label="Interviews" value={interviews} icon={<TrendIcon />} tone="violet" />
          <Stat
            label="Interview rate"
            value={`${rate}%`}
            icon={<TrendIcon />}
            tone="emerald"
            progress={rate}
            foot={`${offers} offer${offers === 1 ? "" : "s"} so far`}
          />
        </div>

        {error ? <Notice kind="error">{error}</Notice> : null}

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input max-w-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by role, company, or city"
          />
          {query ? (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setQuery("")}>
              Clear
            </button>
          ) : null}
        </div>

        {!loading && rows.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<BoardIcon />}
              title="Your pipeline is empty"
              hint="Build today's queue and mark a role as applied — it will appear here automatically."
            />
          </div>
        ) : (
          <div className="board">
            {COLUMNS.map((column) => {
              const items = grouped.get(column.status) ?? [];
              return (
                <section key={column.status} className="col">
                  <div className="col-head">
                    <span className="dot" style={{ color: column.color }} />
                    <span className="col-name">{column.label}</span>
                    <span className="chip ml-auto">{items.length}</span>
                  </div>
                  <div className="col-body">
                    {items.length === 0 ? (
                      <p className="tiny px-1 py-4 text-center">Nothing here</p>
                    ) : (
                      items.map((row) => (
                        <article key={row.id} className="tile">
                          <p className="text-[13px] font-semibold leading-snug">{row.title}</p>
                          <p className="tiny mt-0.5">
                            {row.company}
                            {row.location ? ` · ${row.location}` : ""}
                          </p>
                          <div className="mt-2.5 flex items-center gap-1.5">
                            <select
                              className="select h-7 min-h-0 flex-1 py-0 text-[12px]"
                              value={row.status}
                              onChange={(event) =>
                                move(row, event.target.value as ApplicationStatus)
                              }
                            >
                              {APPLICATION_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                            {row.applyUrl ? (
                              <a
                                href={row.applyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-ghost btn-sm px-2"
                                title="Open job posting"
                              >
                                <ExternalIcon />
                              </a>
                            ) : null}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
