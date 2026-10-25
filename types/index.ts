export type SpeechRecord = {
  id: string;
  topicId: string;
  delegationId: number;
  startedAt: number;
  durationSec: number | null;
  allottedSec: number;
};

export type ReportSortKey = "delegation" | "count" | "total" | "average" | "latest";
