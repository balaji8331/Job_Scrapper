import { getServiceClient } from "@/lib/supabase";
import type { ExperienceItem, Profile } from "@/lib/types";
import { buildResumePdf } from "./pdf";
import { tailorResume } from "./tailor";

export async function generateAndStoreResume(input: {
  userId: string;
  jobId: string;
  profile: Profile;
  job: { title: string; company: string; description: string };
}) {
  const tailored = await tailorResume(input.profile, input.job);
  const pdf = await buildResumePdf({
    profile: input.profile,
    summary: tailored.summary,
    skills: tailored.skills,
    experience: tailored.experience,
    coverLetter: tailored.coverLetter,
    jobTitle: input.job.title,
    company: input.job.company,
  });

  const supabase = getServiceClient();
  const path = `${input.userId}/${input.jobId}.pdf`;
  let pdfPath: string | null = path;
  const upload = await supabase.storage
    .from("resumes")
    .upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upload.error) pdfPath = null;

  const { error } = await supabase.from("resume_versions").upsert(
    {
      user_id: input.userId,
      job_id: input.jobId,
      summary: tailored.summary,
      skills: tailored.skills,
      experience: tailored.experience as ExperienceItem[],
      cover_letter: tailored.coverLetter,
      pdf_path: pdfPath,
    },
    { onConflict: "user_id,job_id" },
  );
  if (error) throw error;

  return {
    pdf,
    pdfPath,
    usedGemini: tailored.usedGemini,
    coverLetter: tailored.coverLetter,
  };
}

export async function downloadStoredPdf(path: string): Promise<Uint8Array | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage.from("resumes").download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
