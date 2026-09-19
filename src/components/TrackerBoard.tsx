"use client";

import { useEffect, useMemo, useState } from "react";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";

interface Row {
  id: string;
  status: ApplicationStatus;
  notes: string;
  appliedAt: string | null;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  source: string;
}

const COLUMNS: ApplicationStatus[] = [
  "saved",
  "queued",
  "applied",
  "interview",
  "rejected",
  "offer",
];

export function TrackerBoard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/applications");
    const data = (await response.json()) as { applications?: Row[]; error?: string };
    if (!response.ok) {
      setMessage(data.error || "Could not load tracker");
      return;
    }
    setRows(data.applications ?? []);
  }

  useEffect(() => {
    let alive = true;
    fetch("/api/applications")
      .then(async (response) => {
        const data = (await response.json()) as { applications?: Row[]; error?: string };
        if (!alive) return;
        if (!response.ok) {
          setMessage(data.error || "Could not load tracker");
          return;
        }
        setRows(data.applications ?? []);
      })
      .catch(() => {
        if (alive) setMessage("Could not load tracker");
      });
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((status) => [status, [] as Row[]])) as Record<
      ApplicationStatus,
      Row[]
    >;
    for (const row of rows) map[row.status]?.push(row);
    return map;
  }, [rows]);

  async function move(row: Row, status: ApplicationStatus) {
    await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: row.id, status }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      <div className="grid gap-3 lg:grid-cols-3">
        {COLUMNS.map((status) => (
          <section key={status} className="rounded-2xl border border-line bg-card p-3">
            <h2 className="mb-3 flex items-center justify-between text-sm font-semibold capitalize">
              {status}
              <span className="text-muted">{grouped[status].length}</span>
            </h2>
            <div className="space-y-2">
              {grouped[status].map((row) => (
                <article key={row.id} className="rounded-xl border border-line bg-background p-3">
                  <p className="text-xs text-muted">
                    {row.company} · {row.source}
                  </p>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted">{row.location}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={row.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent"
                    >
                      Apply link
                    </a>
                    <select
                      value={row.status}
                      onChange={(event) =>
                        move(row, event.target.value as ApplicationStatus)
                      }
                      className="rounded border border-line bg-card px-2 py-1 text-xs"
                    >
                      {APPLICATION_STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
