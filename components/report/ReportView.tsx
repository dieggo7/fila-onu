"use client";

import { useState } from "react";
import { COLORS } from "@/lib/colors";
import { calculateReport, formatDuration, sortReportRows, type ReportRow } from "@/lib/report";
import type { DebateSession, DebateTopic } from "@/lib/sessionStore";
import type { SpeechRecord, ReportSortKey } from "@/types";

type Props = {
  session: DebateSession;
  topics: DebateTopic[];
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
    const xmlEscape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
    const columns = ["Tópico", "Delegação", "Início", "Duração (s)", "Tempo padrão (s)"];
    const rows = records.map((record) => [
      session.topics.find((topic) => topic.id === record.topicId)?.title ?? "",
      session.controls[COLORS[record.delegationId - 1]?.id ?? ""]?.nome ?? COLORS[record.delegationId - 1]?.name ?? "",
      new Date(record.startedAt), record.durationSec, record.allottedSec,
    ] as const);
    const cell = (value: string | number | Date | null, index: number) => {
      if (value === null) return `<Cell ss:StyleID="body"><Data ss:Type="String"></Data></Cell>`;
      if (value instanceof Date) return `<Cell ss:StyleID="date"><Data ss:Type="DateTime">${value.toISOString()}</Data></Cell>`;
      if (typeof value === "number") return `<Cell ss:StyleID="number"><Data ss:Type="Number">${value}</Data></Cell>`;
      return `<Cell ss:StyleID="${index < 2 ? "body" : "number"}"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
    };
    const header = `<Row ss:AutoFitHeight="1">${columns.map((value) => `<Cell ss:StyleID="header"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`).join("")}</Row>`;
    const data = rows.map((row) => `<Row ss:AutoFitHeight="1">${row.map((value, index) => cell(value, index)).join("")}</Row>`).join("");
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="11" ss:Color="#243247"/></Style><Style ss:ID="header"><Interior ss:Color="#243247" ss:Pattern="Solid"/><Font ss:FontName="Aptos" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#243247"/></Borders></Style><Style ss:ID="body"><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/></Borders></Style><Style ss:ID="number"><NumberFormat ss:Format="0"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/></Borders></Style><Style ss:ID="date"><NumberFormat ss:Format="dd/mm/yyyy hh:mm"/><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE3EA"/></Borders></Style></Styles><Worksheet ss:Name="Falas"><Table><Column ss:Width="220"/><Column ss:Width="180"/><Column ss:Width="145"/><Column ss:Width="105"/><Column ss:Width="145"/>${header}${data}</Table><x:WorksheetOptions><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>1</x:SplitHorizontal><x:TopRowBottomPane>1</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane><x:ProtectObjects>False</x:ProtectObjects><x:ProtectScenarios>False</x:ProtectScenarios></x:WorksheetOptions><x:AutoFilter x:Range="R1C1:R${records.length + 1}C5"/></Worksheet></Workbook>`;
    const today = new Date();
    const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
    download(`\uFEFF${xml}`, "application/vnd.ms-excel;charset=utf-8", `vox-relatorio-${date}.xml`);
  }
  return <details className="report-export"><summary className="button button-secondary">Exportar</summary><div className="report-export-menu">
    <button onClick={copySummary}>Copiar resumo</button><button onClick={exportCsv}>Planilha Excel das falas</button>
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

export function ReportView({ session, topics, notify }: Props) {
  const [scope, setScope] = useState("all");
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
  return <section className="report-view screen-transition" aria-labelledby="report-title">
    <div className="report-heading"><div><h1 id="report-title">Relatório</h1><p>Participação das delegações</p></div>
      <div className="report-actions"><label className="visually-hidden" htmlFor="report-scope">Tópico do relatório</label><select id="report-scope" className="button button-secondary report-scope" value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">Todos os tópicos</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
        <ExportMenu rows={statistics.rows} records={statistics.records} notSpoken={statistics.notSpoken} scopeTitle={scopeTitle} session={session} notify={notify} />
      </div></div>
    {statistics.speechCount === 0 ? <p className="report-empty">Nenhuma fala registrada. As falas aparecem aqui quando forem finalizadas.</p> : <>
      <ReportSummary rows={statistics.rows} speechCount={statistics.speechCount} totalSec={statistics.totalSec} scopeTitle={scopeTitle} denominator={denominator} spokenCount={spokenCount} />
      <ReportTable key={scope} rows={statistics.rows} topics={topics} />
      <NotSpokenList delegations={statistics.rows.filter((row) => row.count === 0 && linkedDelegations.some((item) => item.id === row.id))} />
    </>}
  </section>;
}
