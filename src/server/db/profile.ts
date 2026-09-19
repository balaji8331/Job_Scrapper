import { getServiceClient } from "@/lib/supabase";
import type {
  EducationItem,
  ExperienceItem,
  Profile,
  ProjectItem,
} from "@/lib/types";

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  summary: string;
  skills: string[];
  target_roles: string[];
  cities: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    location: row.location,
    linkedinUrl: row.linkedin_url,
    githubUrl: row.github_url,
    portfolioUrl: row.portfolio_url,
    summary: row.summary,
    skills: row.skills ?? [],
    targetRoles: row.target_roles ?? [],
    cities: row.cities ?? [],
    experience: row.experience ?? [],
    education: row.education ?? [],
    projects: row.projects ?? [],
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function upsertProfile(profile: Profile): Promise<Profile> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: profile.userId,
        full_name: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        linkedin_url: profile.linkedinUrl,
        github_url: profile.githubUrl,
        portfolio_url: profile.portfolioUrl,
        summary: profile.summary,
        skills: profile.skills,
        target_roles: profile.targetRoles,
        cities: profile.cities,
        experience: profile.experience,
        education: profile.education,
        projects: profile.projects,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapProfile(data as ProfileRow);
}
