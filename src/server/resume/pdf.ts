import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EducationItem, ExperienceItem, Profile, ProjectItem } from "@/lib/types";

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildResumePdf(input: {
  profile: Profile;
  summary: string;
  skills: string[];
  experience: ExperienceItem[];
  coverLetter?: string;
  jobTitle: string;
  company: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.09, 0.15);
  const muted = rgb(0.32, 0.36, 0.42);
  const accent = rgb(0.05, 0.45, 0.45);

  const pageSize: [number, number] = [595, 842];
  let page = doc.addPage(pageSize);
  let y = 800;
  const left = 48;
  const maxWidth = 499;

  const ensure = (needed: number) => {
    if (y - needed < 48) {
      page = doc.addPage(pageSize);
      y = 800;
    }
  };

  const write = (text: string, size: number, font = regular, color = ink) => {
    const lines = wrap(text, font, size, maxWidth);
    for (const line of lines) {
      ensure(size + 6);
      page.drawText(line, { x: left, y, size, font, color });
      y -= size + 4;
    }
  };

  const heading = (label: string) => {
    ensure(28);
    y -= 8;
    page.drawText(label.toUpperCase(), { x: left, y, size: 10, font: bold, color: accent });
    y -= 6;
    page.drawLine({
      start: { x: left, y },
      end: { x: left + maxWidth, y },
      thickness: 0.6,
      color: rgb(0.82, 0.86, 0.9),
    });
    y -= 14;
  };

  page.drawText(input.profile.fullName || "Candidate", {
    x: left,
    y,
    size: 20,
    font: bold,
    color: ink,
  });
  y -= 18;
  write(`Tailored for ${input.jobTitle} · ${input.company}`, 9, regular, muted);

  const contact = [
    input.profile.email,
    input.profile.phone,
    input.profile.location,
    input.profile.linkedinUrl,
    input.profile.githubUrl,
    input.profile.portfolioUrl,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (contact) write(contact, 9, regular, muted);

  heading("Summary");
  write(input.summary, 10);

  if (input.skills.length) {
    heading("Skills");
    write(input.skills.join("  ·  "), 10);
  }

  if (input.experience.length) {
    heading("Experience");
    for (const item of input.experience) {
      ensure(36);
      page.drawText(`${item.title} — ${item.company}`, { x: left, y, size: 11, font: bold, color: ink });
      y -= 14;
      const dates = [item.start, item.current ? "Present" : item.end].filter(Boolean).join(" – ");
      if (dates) write(dates, 9, regular, muted);
      for (const bullet of item.bullets) write(`• ${bullet}`, 10);
      y -= 6;
    }
  }

  if (input.profile.projects?.length) {
    heading("Projects");
    for (const project of input.profile.projects as ProjectItem[]) {
      write(project.name + (project.url ? `  ${project.url}` : ""), 11, bold);
      for (const bullet of project.bullets ?? []) write(`• ${bullet}`, 10);
      y -= 4;
    }
  }

  if (input.profile.education?.length) {
    heading("Education");
    for (const edu of input.profile.education as EducationItem[]) {
      write(`${edu.degree} — ${edu.school} (${edu.year})`, 10, bold);
    }
  }

  if (input.coverLetter) {
    page = doc.addPage(pageSize);
    y = 800;
    page.drawText("Cover letter", { x: left, y, size: 16, font: bold, color: ink });
    y -= 24;
    write(input.coverLetter, 11);
  }

  return doc.save();
}
