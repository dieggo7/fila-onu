import type { SpeechRecord } from "@/types";

export type ReportDelegation = { id: number; name: string; color: string };
export type ReportRow = ReportDelegation & {
  count: number;
  totalSec: number | null;
  averageSec: number | null;
  latestAt: number | null;
  records: SpeechRecord[];
};

export function calculateReport(
  records: SpeechRecord[],
  delegations: ReportDelegation[],
  topicId: string | "all",
) {
  const scoped = records.filter((record) => topicId === "all" || record.topicId === topicId);
  const rows = delegations.map((delegation): ReportRow => {
    const speeches = scoped.filter((record) => record.delegationId === delegation.id)
      .sort((a, b) => b.startedAt - a.startedAt);
    const timed = speeches.filter((record) => record.durationSec !== null);
    return {
      ...delegation,
      count: speeches.length,
      totalSec: timed.length ? timed.reduce((sum, record) => sum + (record.durationSec ?? 0), 0) : null,
      averageSec: timed.length ? timed.reduce((sum, record) => sum + (record.durationSec ?? 0), 0) / timed.length : null,
      latestAt: speeches[0]?.startedAt ?? null,
      records: speeches,
    };
  });
  return {
    rows,
    spoken: rows.filter((row) => row.count > 0),
    notSpoken: rows.filter((row) => row.count === 0),
    speechCount: scoped.length,
    totalSec: scoped.some((record) => record.durationSec !== null)
      ? scoped.reduce((sum, record) => sum + (record.durationSec ?? 0), 0)
      : null,
    records: scoped,
  };
}

export function sortReportRows(rows: ReportRow[], key: keyof Pick<ReportRow, "name" | "count" | "totalSec" | "averageSec" | "latestAt">, direction: "ascending" | "descending") {
  const sign = direction === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (typeof left === "string" && typeof right === "string") return left.localeCompare(right) * sign;
    return ((left ?? -1) as number - ((right ?? -1) as number)) * sign;
  });
}

export function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
