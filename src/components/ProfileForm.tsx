"use client";

import { useEffect, useState } from "react";
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
          setMessage(data.error);
        }
      })
      .catch(() => setMessage("Could not load profile"));
  }, []);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload: Profile = {
        ...profile,
        skills: skillsText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        targetRoles: rolesText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { profile?: Profile; error?: string };
      if (!response.ok) throw new Error(data.error || "Save failed");
      if (data.profile) setProfile(data.profile);
      setMessage("Profile saved. This is the master resume used for every tailored PDF.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Full name" value={profile.fullName} onChange={(value) => update("fullName", value)} />
        <Field label="Email" value={profile.email} onChange={(value) => update("email", value)} />
        <Field label="Phone" value={profile.phone} onChange={(value) => update("phone", value)} />
        <Field label="Location" value={profile.location} onChange={(value) => update("location", value)} />
        <Field label="LinkedIn" value={profile.linkedinUrl} onChange={(value) => update("linkedinUrl", value)} />
        <Field label="GitHub" value={profile.githubUrl} onChange={(value) => update("githubUrl", value)} />
        <Field
          label="Portfolio"
          value={profile.portfolioUrl}
          onChange={(value) => update("portfolioUrl", value)}
        />
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Summary</span>
        <textarea
          value={profile.summary}
          onChange={(event) => update("summary", event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-line bg-card px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Skills (comma separated)</span>
        <textarea
          value={skillsText}
          onChange={(event) => setSkillsText(event.target.value)}
          rows={3}
          className="w-full rounded-lg border border-line bg-card px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Target roles</span>
        <input
          value={rolesText}
          onChange={(event) => setRolesText(event.target.value)}
          className="w-full rounded-lg border border-line bg-card px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Preferred cities</span>
        <select
          multiple
          value={profile.cities}
          onChange={(event) =>
            update(
              "cities",
              Array.from(event.target.selectedOptions).map((option) => option.value),
            )
          }
          className="h-32 w-full rounded-lg border border-line bg-card px-3 py-2"
        >
          {INDIA_CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <ListEditor
        title="Experience"
        items={profile.experience}
        onChange={(experience) => update("experience", experience)}
        blank={{ company: "", title: "", start: "", end: "", current: false, bullets: [""] }}
        render={(item, setItem) => (
          <div className="grid gap-2 md:grid-cols-2">
            <input
              placeholder="Company"
              value={item.company}
              onChange={(event) => setItem({ ...item, company: event.target.value })}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
            <input
              placeholder="Title"
              value={item.title}
              onChange={(event) => setItem({ ...item, title: event.target.value })}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
            <input
              placeholder="Start"
              value={item.start}
              onChange={(event) => setItem({ ...item, start: event.target.value })}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
            <input
              placeholder="End"
              value={item.end}
              onChange={(event) => setItem({ ...item, end: event.target.value })}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
            <textarea
              placeholder="Bullets, one per line"
              value={item.bullets.join("\n")}
              onChange={(event) =>
                setItem({
                  ...item,
                  bullets: event.target.value.split("\n"),
                })
              }
              rows={4}
              className="md:col-span-2 rounded-lg border border-line bg-background px-3 py-2"
            />
          </div>
        )}
      />

      <ListEditor
        title="Education"
        items={profile.education}
        onChange={(education) => update("education", education)}
        blank={{ school: "", degree: "", year: "" }}
        render={(item, setItem) => (
          <div className="grid gap-2 md:grid-cols-3">
            <input
              placeholder="School"
              value={item.school}
              onChange={(event) => setItem({ ...item, school: event.target.value })}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
            <input
              placeholder="Degree"
              value={item.degree}
              onChange={(event) => setItem({ ...item, degree: event.target.value })}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
            <input
              placeholder="Year"
              value={item.year}
              onChange={(event) => setItem({ ...item, year: event.target.value })}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
          </div>
        )}
      />

      <ListEditor
        title="Projects"
        items={profile.projects}
        onChange={(projects) => update("projects", projects)}
        blank={{ name: "", url: "", bullets: [""] }}
        render={(item, setItem) => (
          <div className="grid gap-2">
            <input
              placeholder="Name"
              value={item.name}
              onChange={(event) => setItem({ ...item, name: event.target.value })}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
            <input
              placeholder="URL"
              value={item.url ?? ""}
              onChange={(event) => setItem({ ...item, url: event.target.value })}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
            <textarea
              placeholder="Bullets, one per line"
              value={item.bullets.join("\n")}
              onChange={(event) => setItem({ ...item, bullets: event.target.value.split("\n") })}
              rows={3}
              className="rounded-lg border border-line bg-background px-3 py-2"
            />
          </div>
        )}
      />

      <button
        disabled={busy}
        className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save profile"}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  );
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
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-card px-3 py-2"
      />
    </label>
  );
}

function ListEditor<T>({
  title,
  items,
  blank,
  onChange,
  render,
}: {
  title: string;
  items: T[];
  blank: T;
  onChange: (items: T[]) => void;
  render: (item: T, setItem: (item: T) => void) => React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => onChange([...items, blank])}
          className="text-sm text-accent"
        >
          Add
        </button>
      </div>
      {items.map((item, index) => (
        <div key={index} className="rounded-2xl border border-line p-3">
          {render(item, (next) => {
            const copy = [...items];
            copy[index] = next;
            onChange(copy);
          })}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            className="mt-2 text-xs text-muted"
          >
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}
