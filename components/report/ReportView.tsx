"use client";

import { useRef, useState } from "react";
import { COLORS } from "@/lib/colors";
import { calculateReport, formatDuration, sortReportRows, type ReportRow } from "@/lib/report";
import type { DebateSession, DebateTopic } from "@/lib/sessionStore";
import type { SpeechRecord, ReportSortKey } from "@/types";

type Props = {
  session: DebateSession;
  topics: DebateTopic[];
  onImport: (session: DebateSession) => boolean;
  notify: (message: string, tone?: "info" | "error") => void;
};

function localTime(timestamp: number | null) {
  return timestamp === null ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(timestamp);
}

function ExportMenu({ rows, records, notSpoken, scopeTitle, session, notify }: {
  rows: ReportRow[]; records: SpeechRecord[]; notSpoken: ReportRow[]; scopeTitle: string;
  session: DebateSession; notify: Props["notify"];
}) {
  function download(content: BlobPart, type: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function copySummary() {
    const ranking = [...rows].filter((row) => row.count).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const lines = [scopeTitle, "", ...ranking.map((row) => `${row.name}: ${row.count} fala(s) · ${formatDuration(row.totalSec)}`), "", "Ainda não falaram:", ...(notSpoken.length ? notSpoken.map((row) => row.name) : ["Todas as delegações já falaram."])];
    void navigator.clipboard.writeText(lines.join("\n")).then(() => notify("Resumo copiado."), () => notify("Não foi possível copiar o resumo.", "error"));
  }
  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const lines = [["Tópico", "Delegação", "Início", "Duração (s)", "Tempo padrão (s)"], ...records.map((record) => [
      session.topics.find((topic) => topic.id === record.topicId)?.title ?? "",
      session.controls[COLORS[record.delegationId - 1]?.id ?? ""]?.nome ?? COLORS[record.delegationId - 1]?.name ?? "",
      new Date(record.startedAt).toLocaleString("pt-BR"), record.durationSec === null ? "" : String(record.durationSec), String(record.allottedSec),
    ])].map((line) => line.map((cell) => escape(String(cell))).join(";"));
    download(`\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8", `vox-relatorio-${new Date().toISOString().slice(0, 10)}.csv`);
  }
  function exportJson() {
    download(JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), session }, null, 2), "application/json;charset=utf-8", `vox-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }
  return <details className="report-export"><summary className="button button-secondary">Exportar</summary><div className="report-export-menu">
    <button onClick={copySummary}>Copiar resumo</button><button onClick={exportCsv}>CSV das falas</button><button onClick={exportJson}>Backup completo (JSON)</button>
  </div></details>;
}

function ReportSummary({ rows, speechCount, totalSec, scopeTitle, denominator, spokenCount }: { rows: ReportRow[]; speechCount: number; totalSec: number | null; scopeTitle: string; denominator: number; spokenCount: number }) {
  const spoken = rows.filter((row) => row.count).sort((a, b) => b.count - a.count);
  return <div className="report-summary">
    <p className="report-summary-count">{speechCount} {speechCount === 1 ? "fala" : "falas"} · {formatDuration(totalSec)} no total · <strong>{spokenCount} de {denominator}</strong> delegações já falaram</p>
    {spoken.length ? <div className="participation-highlight" aria-label={`Mais falas: ${spoken[0]?.name}, ${spoken[0]?.count}. Menos falas: ${spoken[spoken.length - 1]?.name}, ${spoken[spoken.length - 1]?.count}.`}>
      <div className="participation-item participation-most"><span>Mais falas</span><strong>{spoken[0]?.name}<b>{spoken[0]?.count} {spoken[0]?.count === 1 ? "fala" : "falas"}</b></strong></div>
      <div className="participation-item participation-least"><span>Menos falas</span><strong>{spoken[spoken.length - 1]?.name}<b>{spoken[spoken.length - 1]?.count} {spoken[spoken.length - 1]?.count === 1 ? "fala" : "falas"}</b></strong></div>
    </div> : <p className="report-no-participation">Nenhuma fala em {scopeTitle.toLocaleLowerCase()}.</p>}
  </div>;
}

function ReportTable({ rows, topics }: { rows: ReportRow[]; topics: DebateTopic[] }) {
  const [sortKey, setSortKey] = useState<ReportSortKey>("count");
  const [direction, setDirection] = useState<"ascending" | "descending">("descending");
  const [expanded, setExpanded] = useState<number | null>(null);
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  const sortField = sortKey === "delegation" ? "name" : sortKey === "total" ? "totalSec" : sortKey === "average" ? "averageSec" : sortKey === "latest" ? "latestAt" : "count";
  const sortedRows = sortReportRows(rows, sortField, direction);
  function heading(label: string, key: ReportSortKey) {
    const active = sortKey === key;
    return <th aria-sort={active ? direction : "none"}><button onClick={() => { setDirection(active && direction === "descending" ? "ascending" : "descending"); setSortKey(key); }}>{label}</button></th>;
  }
  return <div className="report-table-wrap"><table className="report-table"><thead><tr>{heading("Delegação", "delegation")}{heading("Falas", "count")}{heading("Tempo total", "total")}{heading("Tempo médio", "average")}{heading("Última fala", "latest")}</tr></thead>
    <tbody>{sortedRows.map((row) => <ReportTableRow key={row.id} row={row} topics={topics} maxCount={maxCount} expanded={expanded === row.id} onToggle={() => setExpanded(expanded === row.id ? null : row.id)} />)}</tbody></table></div>;
}

function ReportTableRow({ row, topics, maxCount, expanded, onToggle }: { row: ReportRow; topics: DebateTopic[]; maxCount: number; expanded: boolean; onToggle: () => void }) {
  return <>
    <tr className="report-row" aria-expanded={expanded}>
      <th scope="row"><button className="report-expand" aria-label={`${expanded ? "Ocultar" : "Mostrar"} falas de ${row.name}`} aria-expanded={expanded} onClick={onToggle}><span className="report-delegation"><i style={{ background: row.color }} />{row.name}</span><span aria-hidden="true">{expanded ? "−" : "+"}</span></button></th>
      <td data-label="Falas"><span className="report-count"><span>{row.count}</span><i><b style={{ transform: `scaleX(${row.count / maxCount})` }} /></i></span></td>
      <td data-label="Tempo total">{formatDuration(row.totalSec)}</td><td data-label="Tempo médio">{formatDuration(row.averageSec)}</td><td data-label="Última fala">{localTime(row.latestAt)}</td>
    </tr>
    {expanded && <tr className="report-detail"><td colSpan={5}><ol>{row.records.map((record) => <li key={record.id}><span>{topics.find((topic) => topic.id === record.topicId)?.title ?? "Tópico removido"}</span><time>{localTime(record.startedAt)}</time><span>{formatDuration(record.durationSec)}</span></li>)}</ol></td></tr>}
  </>;
}

function NotSpokenList({ delegations }: { delegations: ReportRow[] }) {
  return <section className="not-spoken"><h2>Quem ainda não falou</h2>{delegations.length ? <ul>{delegations.map((row) => <li key={row.id}><i style={{ background: row.color }} />{row.name}</li>)}</ul> : <p>Todas as delegações já falaram.</p>}</section>;
}

function validBackup(value: unknown): value is { version: 3; session: DebateSession } {
  if (!value || typeof value !== "object") return false;
  const backup = value as Record<string, unknown>;
  if (backup.version !== 3 || typeof backup.exportedAt !== "string" || !Number.isFinite(Date.parse(backup.exportedAt)) || !backup.session || typeof backup.session !== "object") return false;
  const session = backup.session as Record<string, unknown>;
  if (!Array.isArray(session.topics) || !Array.isArray(session.speechLog) || !session.controls || typeof session.controls !== "object" || typeof session.activeTopicId !== "string" || typeof session.defaultDuration !== "number" || !Number.isFinite(session.defaultDuration) || session.defaultDuration < 1 || session.defaultDuration > 3600) return false;
  if (!session.topics.every((topic) => !!topic && typeof topic === "object" && typeof (topic as DebateTopic).id === "string" && typeof (topic as DebateTopic).title === "string" && Array.isArray((topic as DebateTopic).waiting) && (topic as DebateTopic).waiting.every((id) => typeof id === "string" && COLORS.some((color) => color.id === id)) && ((topic as DebateTopic).currentSpeaker === null || COLORS.some((color) => color.id === (topic as DebateTopic).currentSpeaker)) && typeof (topic as DebateTopic).remainingSeconds === "number" && Number.isFinite((topic as DebateTopic).remainingSeconds) && typeof (topic as DebateTopic).currentSpeakerTimerStarted === "boolean" && ((topic as DebateTopic).currentSpeakerStartedAt === null || (typeof (topic as DebateTopic).currentSpeakerStartedAt === "number" && Number.isFinite((topic as DebateTopic).currentSpeakerStartedAt))) && ((topic as DebateTopic).currentSpeakerAllottedSec === null || (typeof (topic as DebateTopic).currentSpeakerAllottedSec === "number" && Number.isFinite((topic as DebateTopic).currentSpeakerAllottedSec))) && ((topic as DebateTopic).currentSpeakerTimerInitialSec === null || (typeof (topic as DebateTopic).currentSpeakerTimerInitialSec === "number" && Number.isFinite((topic as DebateTopic).currentSpeakerTimerInitialSec))))) return false;
  const topicIds = new Set(session.topics.map((topic) => (topic as DebateTopic).id));
  if (topicIds.size !== session.topics.length) return false;
  if (!COLORS.every((color) => {
    const control = (session.controls as Record<string, unknown>)[color.id];
    return !!control && typeof control === "object" && typeof (control as { nome?: unknown }).nome === "string" && ((control as { code?: unknown }).code === null || (typeof (control as { code?: unknown }).code === "number" && Number.isFinite((control as { code: number }).code)));
  })) return false;
  if (!session.speechLog.every((record) => !!record && typeof record === "object" && typeof (record as SpeechRecord).id === "string" && typeof (record as SpeechRecord).topicId === "string" && topicIds.has((record as SpeechRecord).topicId) && Number.isInteger((record as SpeechRecord).delegationId) && (record as SpeechRecord).delegationId >= 1 && (record as SpeechRecord).delegationId <= COLORS.length && typeof (record as SpeechRecord).startedAt === "number" && Number.isFinite((record as SpeechRecord).startedAt) && ((record as SpeechRecord).durationSec === null || (typeof (record as SpeechRecord).durationSec === "number" && Number.isFinite((record as SpeechRecord).durationSec))) && typeof (record as SpeechRecord).allottedSec === "number" && Number.isFinite((record as SpeechRecord).allottedSec))) return false;
  return session.topics.some((topic) => (topic as DebateTopic).id === session.activeTopicId);
}

export function ReportView({ session, topics, onImport, notify }: Props) {
  const [scope, setScope] = useState("all");
  const importRef = useRef<HTMLInputElement>(null);
  const linkedDelegations = COLORS.flatMap((color, index) => session.controls[color.id]?.code !== null
    ? [{ id: index + 1, name: session.controls[color.id]?.nome.trim() || color.name, color: color.hex }]
    : []);
  const spokenIds = new Set(session.speechLog.map((record) => record.delegationId));
  const spokenDelegations = COLORS.flatMap((color, index) => spokenIds.has(index + 1) ? [{ id: index + 1, name: session.controls[color.id]?.nome.trim() || color.name, color: color.hex }] : []);
  const roster = [...linkedDelegations, ...spokenDelegations.filter((item) => !linkedDelegations.some((linked) => linked.id === item.id))];
  const statistics = calculateReport(session.speechLog, roster, scope);
  const denominator = linkedDelegations.length || statistics.spoken.length;
  const spokenCount = linkedDelegations.length
    ? statistics.rows.filter((row) => row.count > 0 && linkedDelegations.some((item) => item.id === row.id)).length
    : statistics.spoken.length;
  const scopeTitle = scope === "all" ? "Todos os tópicos" : topics.find((topic) => topic.id === scope)?.title ?? "Tópico";
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!validBackup(parsed)) throw new Error("O arquivo não é um backup VOX válido na versão 3.");
      const imported = parsed.session;
      const confirmed = window.confirm(`Isso substitui os dados atuais: ${imported.topics.length} tópicos, ${imported.speechLog.length} falas. Deseja continuar?`);
      if (confirmed) {
        if (onImport(imported)) notify("Backup importado.");
        else notify("O armazenamento está cheio. O backup foi aplicado apenas nesta sessão.", "error",);
      }
    } catch (error) { notify(error instanceof Error ? error.message : "Não foi possível ler esse arquivo.", "error"); }
    if (importRef.current) importRef.current.value = "";
  }
  return <section className="report-view screen-transition" aria-labelledby="report-title">
    <div className="report-heading"><div><h1 id="report-title">Relatório</h1><p>Participação das delegações</p></div>
      <div className="report-actions"><label className="visually-hidden" htmlFor="report-scope">Tópico do relatório</label><select id="report-scope" value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">Todos os tópicos</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
        <ExportMenu rows={statistics.rows} records={statistics.records} notSpoken={statistics.notSpoken} scopeTitle={scopeTitle} session={session} notify={notify} />
        <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /><button className="button button-secondary" onClick={() => importRef.current?.click()}>Importar</button>
      </div></div>
    {statistics.speechCount === 0 ? <p className="report-empty">Nenhuma fala registrada. As falas aparecem aqui quando forem finalizadas.</p> : <>
      <ReportSummary rows={statistics.rows} speechCount={statistics.speechCount} totalSec={statistics.totalSec} scopeTitle={scopeTitle} denominator={denominator} spokenCount={spokenCount} />
      <ReportTable key={scope} rows={statistics.rows} topics={topics} />
      <NotSpokenList delegations={statistics.rows.filter((row) => row.count === 0 && linkedDelegations.some((item) => item.id === row.id))} />
    </>}
  </section>;
}
