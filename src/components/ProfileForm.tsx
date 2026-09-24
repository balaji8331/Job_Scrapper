"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Notice, SectionCard } from "@/components/ui/bits";
import { CheckIcon, PlusIcon, TrashIcon, UserIcon } from "@/components/ui/icons";
import { INDIA_CITIES } from "@/lib/constants";
import type { Profile } from "@/lib/types";

const EMPTY: Profile = {
  userId: "",
  fullName: "",
  email: "",
  phone: "",
  location: "Bengaluru, India",
  linkedinUrl: "",
  githubUrl: "",
  portfolioUrl: "",
  summary: "",
  skills: [],
  targetRoles: [],
  cities: ["Bengaluru"],
  experience: [],
  education: [],
  projects: [],
};

export function ProfileForm() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [skillsText, setSkillsText] = useState("");
  const [rolesText, setRolesText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/profile")
      .then(async (response) => {
        const data = (await response.json()) as { profile?: Profile; error?: string };
        if (data.profile) {
          setProfile(data.profile);
          setSkillsText(data.profile.skills.join(", "));
          setRolesText(data.profile.targetRoles.join(", "));
        } else if (data.error) {
          setError(data.error);
        }
      })
      .catch(() => setError("Could not load profile"));
  }, []);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function toggleCity(city: string) {
    const has = profile.cities.includes(city);
    update("cities", has ? profile.cities.filter((item) => item !== city) : [...profile.cities, city]);
  }

  const completeness = useMemo(() => {
    const checks = [
      Boolean(profile.fullName && profile.email),
      Boolean(profile.summary),
      skillsText.trim().length > 0,
      rolesText.trim().length > 0,
      profile.experience.length > 0,
      profile.education.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile, skillsText, rolesText]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload: Profile = {
        ...profile,
        skills: splitList(skillsText),
        targetRoles: splitList(rolesText),
      };
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { profile?: Profile; error?: string };
      if (!response.ok) throw new Error(data.error || "Save failed");
      if (data.profile) setProfile(data.profile);
      setMessage("Profile saved. This is the master resume behind every tailored PDF.");
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <PageHeader
        title="Profile"
        description="Your master resume. Scoring and every tailored PDF are generated only from what you enter here."
        actions={
          <>
            <span className="chip chip-primary">{completeness}% complete</span>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <CheckIcon />
              {busy ? "Saving…" : "Save profile"}
            </button>
          </>
        }
      />

      <div className="page space-y-4">
        {error ? <Notice kind="error">{error}</Notice> : null}
        {message && !error ? <Notice kind="ok">{message}</Notice> : null}

        <SectionCard title="Identity" subtitle="Appears in the header of every generated resume">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Full name" value={profile.fullName} onChange={(v) => update("fullName", v)} />
            <Field label="Email" value={profile.email} onChange={(v) => update("email", v)} />
            <Field label="Phone" value={profile.phone} onChange={(v) => update("phone", v)} />
            <Field label="Location" value={profile.location} onChange={(v) => update("location", v)} />
            <Field label="LinkedIn" value={profile.linkedinUrl} onChange={(v) => update("linkedinUrl", v)} />
            <Field label="GitHub" value={profile.githubUrl} onChange={(v) => update("githubUrl", v)} />
            <div className="md:col-span-2">
              <Field
                label="Portfolio"
                value={profile.portfolioUrl}
                onChange={(v) => update("portfolioUrl", v)}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Positioning" subtitle="Drives job scoring and the resume summary">
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="p-summary">
                Professional summary
              </label>
              <textarea
                id="p-summary"
                className="textarea"
                rows={4}
                value={profile.summary}
                onChange={(event) => update("summary", event.target.value)}
                placeholder="Two or three lines on what you build and the impact you have had."
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="p-skills">
                  Skills
                </label>
                <textarea
                  id="p-skills"
                  className="textarea"
                  rows={3}
                  value={skillsText}
                  onChange={(event) => setSkillsText(event.target.value)}
                  placeholder="Python, FastAPI, PostgreSQL, Docker"
                />
                <p className="tiny mt-1">Comma separated. Used for the skill-overlap score.</p>
              </div>
              <div>
                <label className="label" htmlFor="p-roles">
                  Target roles
                </label>
                <textarea
                  id="p-roles"
                  className="textarea"
                  rows={3}
                  value={rolesText}
                  onChange={(event) => setRolesText(event.target.value)}
                  placeholder="Backend Engineer, Platform Engineer"
                />
                <p className="tiny mt-1">Comma separated. Seeds the search queries.</p>
              </div>
            </div>
            <div>
              <span className="label">Preferred cities</span>
              <div className="flex flex-wrap gap-1.5">
                {INDIA_CITIES.map((city) => {
                  const active = profile.cities.includes(city);
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => toggleCity(city)}
                      className={`chip ${active ? "chip-primary" : ""}`}
                      style={{ cursor: "pointer" }}
                    >
                      {active ? <CheckIcon className="h-3 w-3" /> : null}
                      {city}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        <ListEditor
          title="Experience"
          subtitle="Newest first. Bullets are rewritten per job, never invented."
          items={profile.experience}
          onChange={(experience) => update("experience", experience)}
          blank={{ company: "", title: "", start: "", end: "", current: false, bullets: [""] }}
          summary={(item) => item.title || item.company || "New role"}
          render={(item, setItem) => (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Company" value={item.company} onChange={(v) => setItem({ ...item, company: v })} />
              <Field label="Title" value={item.title} onChange={(v) => setItem({ ...item, title: v })} />
              <Field label="Start" value={item.start} onChange={(v) => setItem({ ...item, start: v })} />
              <Field label="End" value={item.end} onChange={(v) => setItem({ ...item, end: v })} />
              <div className="md:col-span-2">
                <span className="label">Bullets, one per line</span>
                <textarea
                  className="textarea"
                  rows={4}
                  value={item.bullets.join("\n")}
                  onChange={(event) => setItem({ ...item, bullets: event.target.value.split("\n") })}
                />
              </div>
            </div>
          )}
        />

        <ListEditor
          title="Education"
          items={profile.education}
          onChange={(education) => update("education", education)}
          blank={{ school: "", degree: "", year: "" }}
          summary={(item) => item.school || "New entry"}
          render={(item, setItem) => (
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="School" value={item.school} onChange={(v) => setItem({ ...item, school: v })} />
              <Field label="Degree" value={item.degree} onChange={(v) => setItem({ ...item, degree: v })} />
              <Field label="Year" value={item.year} onChange={(v) => setItem({ ...item, year: v })} />
            </div>
          )}
        />

        <ListEditor
          title="Projects"
          subtitle="Optional, but strong signal for product and startup roles"
          items={profile.projects}
          onChange={(projects) => update("projects", projects)}
          blank={{ name: "", url: "", bullets: [""] }}
          summary={(item) => item.name || "New project"}
          render={(item, setItem) => (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name" value={item.name} onChange={(v) => setItem({ ...item, name: v })} />
              <Field label="URL" value={item.url ?? ""} onChange={(v) => setItem({ ...item, url: v })} />
              <div className="md:col-span-2">
                <span className="label">Bullets, one per line</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={item.bullets.join("\n")}
                  onChange={(event) => setItem({ ...item, bullets: event.target.value.split("\n") })}
                />
              </div>
            </div>
          )}
        />

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <UserIcon />
            {busy ? "Saving…" : "Save profile"}
          </button>
          <span className="tiny">Nothing is sent to a job board until you press apply yourself.</span>
        </div>
      </div>
    </form>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ListEditor<T>({
  title,
  subtitle,
  items,
  blank,
  onChange,
  render,
  summary,
}: {
  title: string;
  subtitle?: string;
  items: T[];
  blank: T;
  onChange: (items: T[]) => void;
  render: (item: T, setItem: (item: T) => void) => React.ReactNode;
  summary: (item: T) => string;
}) {
  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      action={
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onChange([...items, structuredClone(blank)])}
        >
          <PlusIcon />
          Add
        </button>
      }
    >
      {items.length === 0 ? (
        <p className="tiny py-2">Nothing added yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="panel p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="eyebrow">{summary(item)}</span>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                >
                  <TrashIcon />
                  Remove
                </button>
              </div>
              {render(item, (next) => {
                const copy = [...items];
                copy[index] = next;
                onChange(copy);
              })}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
