"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COLORS, COUNTRY_SUGGESTIONS } from "@/lib/colors";
import type { UndoChange } from "@/lib/useSpeakers";
import { useControls } from "@/lib/useControls";
import { useSpeakers } from "@/lib/useSpeakers";
import { useTimer } from "@/lib/useTimer";
import { useTopics } from "@/lib/useTopics";
import { useSerial } from "@/lib/useSerial";

type Screen = "queue" | "controls";
type Toast = { id: number; message: string; tone: "info" | "error"; undo?: () => void };

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseTime(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export default function Home() {
  const { controls, rename, bindCode } = useControls();
  const topics = useTopics();
  const speakers = useSpeakers();
  const { enroll } = speakers;
  const timer = useTimer();
  const [screen, setScreen] = useState<Screen>("queue");
  const [learning, setLearning] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [manualId, setManualId] = useState(COLORS[0].id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const durationInput = useRef<HTMLInputElement>(null);
  const appRef = useRef<HTMLElement>(null);
  const learnRef = useRef<string | null>(null);
  const controlsRef = useRef(controls);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { controlsRef.current = controls; }, [controls]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "info", duration = 4000, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, tone, undo });
    if (duration > 0) toastTimer.current = setTimeout(() => setToast(null), duration);
  }, []);

  const processCode = useCallback((code: number) => {
    const target = learnRef.current;
    if (target) {
      const oldOwner = Object.entries(controlsRef.current).find(([, item]) => item.code === code)?.[0];
      bindCode(target, code);
      const targetColor = COLORS.find((color) => color.id === target);
      const oldColor = COLORS.find((color) => color.id === oldOwner);
      const message = oldOwner && oldOwner !== target
        ? `Código ${code} vinculado a ${targetColor?.name}. Foi movido de ${oldColor?.name}.`
        : `Código ${code} vinculado a ${targetColor?.name}.`;
      notify(message);
      learnRef.current = null;
      setLearning(null);
      setConfirmed(target);
      window.setTimeout(() => setConfirmed((current) => current === target ? null : current), 1800);
      return;
    }
    const match = Object.entries(controlsRef.current).find(([, config]) => config.code === code);
    if (match) enroll(match[0]);
    else notify(`Código desconhecido: ${code}`, "error");
  }, [bindCode, enroll, notify]);

  const serial = useSerial(processCode, (message) => notify(message, "error", 0), () => notify("Cabo desconectado. Conecte o ESP32 novamente.", "error"));
  const linkedCount = Object.values(controls).filter((item) => item.code !== null).length;
  const currentColor = COLORS.find((color) => color.id === speakers.topic.currentSpeaker);
  const nextSpeakers = speakers.topic.waiting;

  useEffect(() => {
    const onFullscreenChange = () => setFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function startLearning(id: string) {
    const next = learnRef.current === id ? null : id;
    learnRef.current = next;
    setLearning(next);
    setConfirmed(null);
  }

  function dismissToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await appRef.current?.requestFullscreen();
    } catch { notify("Não foi possível ativar a tela cheia.", "error"); }
  }

  function finishSpeech() {
    timer.pause();
    const result: UndoChange | null = speakers.finish();
    if (result) notify(result.label, "info", 6000, result.undo);
  }

  function copyAgenda() {
    const topic = topics.activeTopic;
    const nameFor = (id: string) => controls[id]?.nome.trim() || COLORS.find((color) => color.id === id)?.name || id;
    const lines = [
      `Tópico: ${topic.title}`,
      `Falando agora: ${topic.currentSpeaker ? nameFor(topic.currentSpeaker) : "—"}`,
      "Próximos oradores:",
      ...topic.waiting.map((id, index) => `${index + 1}. ${nameFor(id)}`),
      "Já falaram:",
      ...topic.history.map((speech, index) => `${index + 1}. ${nameFor(speech.id)}`),
    ];
    void navigator.clipboard.writeText(lines.join("\n")).then(() => notify("Lista copiada."), () => notify("Não foi possível copiar a lista.", "error"));
  }

  function setDuration() {
    const seconds = parseTime(durationInput.current?.value ?? "");
    if (seconds === null || seconds < 1) {
      if (durationInput.current) durationInput.current.value = formatTime(timer.defaultDuration);
      notify("Use o formato minutos:segundos, por exemplo 1:30.", "error");
      return;
    }
    timer.setDuration(seconds);
  }

  function createTopic() {
    const title = window.prompt("Nome do novo tópico:")?.trim();
    if (title) topics.create(title);
  }

  function renameTopic() {
    const title = window.prompt("Renomear tópico:", topics.activeTopic.title)?.trim();
    if (title) topics.rename(topics.activeTopicId, title);
  }

  function deleteTopic() {
    if (topics.topics.length <= 1) return;
    if (window.confirm(`Excluir o tópico “${topics.activeTopic.title}” e todo o seu histórico?`)) topics.remove(topics.activeTopicId);
  }

  const nameFor = (id: string) => controls[id]?.nome.trim() || COLORS.find((color) => color.id === id)?.name || id;

  return (
    <main ref={appRef} className={`app-shell ${fullScreen && screen === "queue" ? "is-projector" : ""}`}>
      {!serial.supported && <div className="browser-warning" role="status">Web Serial indisponível neste navegador. Use Chrome ou Edge no computador.</div>}
      <header className="topbar">
        <a className="app-name" href="#fila">Fila de Controles</a>
        <div className="connection-area">
          {serial.connected ? <><span className="status"><i />Conectado</span><button className="button button-secondary" onClick={() => void serial.disconnect()}>Desconectar</button></> : <><span className="status disconnected"><i />Desconectado</span><button className="button button-primary" onClick={() => void serial.connect()}>Conectar</button></>}
        </div>
      </header>
      <nav className="tabs" aria-label="Telas">
        <button className={`tab ${screen === "queue" ? "active" : ""}`} aria-current={screen === "queue" ? "page" : undefined} onClick={() => setScreen("queue")}>Debate</button>
        <button className={`tab ${screen === "controls" ? "active" : ""}`} aria-current={screen === "controls" ? "page" : undefined} onClick={() => setScreen("controls")}>Controles</button>
      </nav>

      {toast && <div key={toast.id} className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} aria-live="polite"><span>{toast.message}</span>{toast.undo && <button className="undo-button" onClick={() => { toast.undo?.(); dismissToast(); }}>Desfazer</button>}<button aria-label="Dispensar mensagem" onClick={dismissToast}>×</button></div>}

      {screen === "queue" ? <section className="debate-view" aria-label="Debate">
<div className="topic-bar"><div className="topic-picker"><label className="visually-hidden" htmlFor="active-topic">Tópico ativo</label><select id="active-topic" value={topics.activeTopicId} onChange={(event) => { timer.pause(); topics.selectTopic(event.target.value); }}>{topics.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select><details className="topic-menu"><summary className="icon-button" aria-label="Ações do tópico">⋯</summary><div className="topic-menu-content"><button className="text-button" onClick={createTopic}>Novo tópico</button><button className="text-button" onClick={renameTopic}>Renomear</button><button className="text-button danger-text" onClick={deleteTopic} disabled={topics.topics.length <= 1}>Excluir</button></div></details></div></div>

        <section className={`speaker-panel ${timer.remaining <= 10 && speakers.topic.currentSpeaker ? "timer-warning" : ""} ${timer.remaining === 0 && speakers.topic.currentSpeaker ? "timer-expired" : ""}`} aria-labelledby="speaker-heading" aria-live="polite">
          <div className="speaker-ident"><h1 id="speaker-heading">Falando agora</h1>{currentColor && <div className="current-speaker"><span className="speaker-swatch" style={{ background: currentColor.hex }} />{nameFor(currentColor.id)}</div>}{!currentColor && <p className="no-speaker">Nenhuma delegação chamada</p>}</div>
          <div className="timer-readout" aria-label={speakers.topic.currentSpeaker ? `Tempo restante ${formatTime(timer.remaining)}` : "Sem orador no momento"}>{speakers.topic.currentSpeaker ? formatTime(timer.remaining) : "--:--"}</div>
          <div className="timer-controls"><button className="button button-primary" onClick={timer.running ? timer.pause : timer.start} disabled={!speakers.topic.currentSpeaker || timer.remaining === 0}>{timer.running ? "Pausar" : "Iniciar"}</button></div>
          <button className="button finish-button" onClick={finishSpeech} disabled={!speakers.topic.currentSpeaker}>Finalizar fala</button>
        </section>

<div className="debate-tools"><h2>Próximos oradores ({nextSpeakers.length})</h2><details className="tools-menu"><summary className="button button-secondary">Ferramentas</summary><div className="tools-menu-content"><button className="button button-secondary" onClick={copyAgenda}>Copiar lista</button><label className="manual-add"><span className="visually-hidden">Delegação para adicionar</span><select aria-label="Delegação para adicionar" value={manualId} onChange={(event) => setManualId(event.target.value)}>{COLORS.map((color) => <option key={color.id} value={color.id}>{nameFor(color.id)}</option>)}</select><button className="button button-secondary" onClick={() => speakers.enroll(manualId)}>Adicionar manualmente</button></label><label className="duration-setting">Tempo padrão<input key={timer.defaultDuration} ref={durationInput} aria-label="Tempo padrão em minutos e segundos" defaultValue={formatTime(timer.defaultDuration)} onBlur={setDuration} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label><button className="button button-secondary" onClick={timer.restart} disabled={!speakers.topic.currentSpeaker}>Reiniciar tempo</button><button className="icon-button" onClick={() => void toggleFullscreen()} aria-label={fullScreen ? "Sair do modo telão" : "Ativar modo telão"} title={fullScreen ? "Sair do modo telão" : "Modo telão"}>{fullScreen ? "⤢" : "⛶"}</button></div></details></div>
        <ol className="speaker-list" aria-live="polite" aria-relevant="additions removals">
          {speakers.topic.waiting.map((id, index) => {
            const color = COLORS.find((item) => item.id === id);
            if (!color) return null;
            const timesSpoken = speakers.topic.history.filter((speech) => speech.id === id).length;
            return <li className="speaker-row" key={`${id}-${index}`} style={{ "--speaker-color": color.hex } as React.CSSProperties}>
              <span className="speaker-position">{index + 1}.</span><div className="speaker-description"><span className="speaker-swatch" aria-hidden="true" /><span className="speaker-name">{nameFor(id)}</span><span className="spoken-count">{timesSpoken ? `Falou ${timesSpoken}x` : "Ainda não falou"}</span></div>
              <div className="speaker-actions"><button className="button button-primary call-button" onClick={() => { timer.pause(); speakers.call(id); }} aria-label={`Chamar ${nameFor(id)}`}>Chamar</button><details className="speaker-menu"><summary className="icon-button" aria-label={`Mais ações para ${nameFor(id)}`}>⋯</summary><div className="speaker-menu-content"><button className="icon-button" aria-label={`Subir ${nameFor(id)}`} disabled={index === 0} onClick={() => speakers.move(id, -1)}>↑</button><button className="icon-button" aria-label={`Descer ${nameFor(id)}`} disabled={index === speakers.topic.waiting.length - 1} onClick={() => speakers.move(id, 1)}>↓</button><button className="icon-button danger-icon" aria-label={`Remover ${nameFor(id)} da lista`} onClick={() => { const change = speakers.remove(id); notify(change.label, "info", 6000, change.undo); }}>×</button></div></details></div>
            </li>;
          })}
        </ol>
        {speakers.topic.waiting.length === 0 && <p className="waiting-empty">Aguardando inscrições neste tópico.</p>}
        <details className="history-section" open={historyOpen} onToggle={(event) => setHistoryOpen(event.currentTarget.open)}><summary>Já falaram <span>{speakers.topic.history.length}</span></summary><ol>{speakers.topic.history.map((speech, index) => <li key={`${speech.id}-${speech.finishedAt}-${index}`}><span>{index + 1}.</span>{nameFor(speech.id)}<small>{formatTime(speech.durationSeconds)}</small></li>)}</ol></details>

        <div className="projector-view" aria-live="polite"><p className="projector-topic">{topics.activeTopic.title}</p><h1>Falando agora</h1>{currentColor ? <><div className="projector-speaker"><span className="speaker-swatch" style={{ background: currentColor.hex }} />{nameFor(currentColor.id)}</div><div className="projector-time">{formatTime(timer.remaining)}</div></> : <p className="projector-empty">Aguardando próxima delegação</p>}<h2>Próximos</h2><ol>{speakers.topic.waiting.slice(0, 5).map((id, index) => { const color = COLORS.find((item) => item.id === id); return <li key={`${id}-${index}`}><span>{index + 1}.</span><i style={{ background: color?.hex }} />{nameFor(id)}</li>; })}</ol></div>
      </section> : <section className="controls-view" aria-labelledby="controls-title">
        <div className="controls-heading"><h1 id="controls-title">Controles</h1><p><strong>{linkedCount} de 15</strong> delegações vinculadas</p></div>
        <datalist id="country-suggestions">{COUNTRY_SUGGESTIONS.map((country) => <option key={country} value={country} />)}</datalist>
        <div className="control-grid">{COLORS.map((color) => {
          const config = controls[color.id];
          const isLearning = learning === color.id;
          const isConfirmed = confirmed === color.id;
          return <article className={`control-card ${config?.code === null ? "needs-link" : "is-linked"} ${isLearning ? "is-learning" : ""}`} key={color.id} style={{ "--control-color": color.hex } as React.CSSProperties}>
            <div className="card-name"><span className="color-swatch" aria-hidden="true" /><label className="visually-hidden" htmlFor={`name-${color.id}`}>Nome da delegação</label><input className="name-input" id={`name-${color.id}`} list="country-suggestions" placeholder={color.name} value={config?.nome ?? color.name} onChange={(event) => rename(color.id, event.target.value)} /></div>
            <div className="binding-status">{config?.code === null ? <><span className="unbound-dot" />Sem código</> : <><span className="check-mark" aria-hidden="true">✓</span>{isConfirmed ? "Vinculado!" : "Vinculado"}<span className="code-number">{config?.code}</span></>}</div>
            {isLearning ? <div className="learn-prompt"><p>Aperte o botão do controle {color.name} agora.</p><button className="button button-secondary cancel-button" onClick={() => startLearning(color.id)}>Cancelar</button></div> : <div className="card-actions"><button className={`button ${config?.code === null ? "button-primary" : "button-secondary"}`} onClick={() => startLearning(color.id)}>{config?.code === null ? "Vincular" : "Refazer"}</button><button className="test-link" onClick={() => speakers.enroll(color.id)}>Testar</button></div>}
          </article>;
        })}</div>
      </section>}
    </main>
  );
}
