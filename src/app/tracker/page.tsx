import { TrackerBoard } from "@/components/TrackerBoard";

export default function TrackerPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Application tracker</h1>
        <p className="text-sm text-muted">
          Move jobs from queued to applied, interview, offer, or rejected.
        </p>
      </div>
      <TrackerBoard />
    </div>
  );
}
