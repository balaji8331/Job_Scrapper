import { ProfileForm } from "@/components/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Master profile</h1>
        <p className="text-sm text-muted">
          Saved once, then tailored per job. You can polish this in Gemini Docs first, then paste
          it here.
        </p>
      </div>
      <ProfileForm />
    </div>
  );
}
