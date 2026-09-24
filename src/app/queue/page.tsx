import { Suspense } from "react";
import { QueueView } from "@/components/QueueView";

export const metadata = { title: "Today's queue · Job OS" };

export default function QueuePage() {
  return (
    <Suspense fallback={<div className="page tiny">Loading queue…</div>}>
      <QueueView />
    </Suspense>
  );
}
