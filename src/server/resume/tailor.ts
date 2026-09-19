import type { ExperienceItem, Profile } from "@/lib/types";
import { geminiTailor } from "@/server/ranking/gemini";

function keywordFallback(profile: Profile, description: string, title: string) {
  const text = `${title} ${description}`.toLowerCase();
  const skills = [...profile.skills].sort((a, b) => {
    const aHit = text.includes(a.toLowerCase()) ? 0 : 1;
    const bHit = text.includes(b.toLowerCase()) ? 0 : 1;
    return aHit - bHit;
  });
  const experience = profile.experience.map((item) => {
    const ranked = [...item.bullets].sort((a, b) => {
      const aScore = skills.filter((skill) => a.toLowerCase().includes(skill.toLowerCase())).length;
      const bScore = skills.filter((skill) => b.toLowerCase().includes(skill.toLowerCase())).length;
      return bScore - aScore;
    });
    return {
      company: item.company,
      title: item.title,
      start: item.start,
      end: item.current ? "Present" : item.end,
      current: item.current,
      bullets: ranked.slice(0, 5),
    } satisfies ExperienceItem;
  });
  const hitSkills = skills.filter((skill) => text.includes(skill.toLowerCase())).slice(0, 6);
  const summary =
    profile.summary ||
    `${profile.fullName} is targeting ${title}. Core skills: ${hitSkills.join(", ") || skills.slice(0, 6).join(", ")}.`;
  const coverLetter = `Dear Hiring Team,\n\nI am applying for the ${title} role. My background in ${skills.slice(0, 5).join(", ")} maps to this opening, and I would welcome the chance to contribute from ${profile.location || "India"}.\n\nThank you,\n${profile.fullName}`;
  return { summary, skills, experience, coverLetter };
}

export async function tailorResume(
  profile: Profile,
  job: { title: string; company: string; description: string },
) {
  const fallback = keywordFallback(profile, job.description, job.title);
  const ai = await geminiTailor({ profile, job });
  if (!ai) return { ...fallback, usedGemini: false };

  const experience = (ai.experience?.length ? ai.experience : fallback.experience).map((item, index) => {
    const original = profile.experience[index];
    return {
      company: item.company || original?.company || "",
      title: item.title || original?.title || "",
      start: original?.start ?? "",
      end: original?.current ? "Present" : (original?.end ?? ""),
      current: original?.current,
      bullets: item.bullets?.length ? item.bullets : original?.bullets ?? [],
    } satisfies ExperienceItem;
  });

  return {
    summary: ai.summary || fallback.summary,
    skills: ai.skills?.length ? ai.skills : fallback.skills,
    experience,
    coverLetter: ai.coverLetter || fallback.coverLetter,
    usedGemini: true,
  };
}
