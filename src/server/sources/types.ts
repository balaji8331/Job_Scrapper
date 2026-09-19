import type { JobSearchQuery, JobSourceId, NormalizedJob } from "@/lib/types";

export interface JobSource {
  id: JobSourceId;
  search(query: JobSearchQuery): Promise<NormalizedJob[]>;
}

export const FETCH_TIMEOUT_MS = 6000;
