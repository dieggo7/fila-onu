import { COLORS } from "./colors";

export type SpeechRecord = { id: string; durationSeconds: number; finishedAt: number };
export type DebateTopic = {
  id: string;
  title: string;
  waiting: string[];
  currentSpeaker: string | null;
  history: SpeechRecord[];
  remainingSeconds: number;
};
export type DebateSession = {
  controls: Record<string, { nome: string; code: number | null }>;
  topics: DebateTopic[];
  activeTopicId: string;
  defaultDuration: number;
};

export const SESSION_KEY = "fila-controles:v2";
const CHANGE_EVENT = "fila-session-change";

function defaultControls() {
  return Object.fromEntries(COLORS.map((color) => [color.id, { nome: color.name, code: null as number | null }]));
}

export function createTopic(title = "Tópico 1"): DebateTopic {
  return { id: crypto.randomUUID(), title, waiting: [], currentSpeaker: null, history: [], remainingSeconds: 90 };
}

export function defaultSession(): DebateSession {
  const topic: DebateTopic = { id: "topic-1", title: "Tópico 1", waiting: [], currentSpeaker: null, history: [], remainingSeconds: 90 };
  return { controls: defaultControls(), topics: [topic], activeTopicId: topic.id, defaultDuration: 90 };
}

export function parseSession(raw: string): DebateSession {
  const defaults = defaultSession();
  if (!raw) return defaults;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return defaults;
    const saved = value as Record<string, unknown>;
    const rawControls = saved.controls && typeof saved.controls === "object"
      ? saved.controls as Record<string, unknown>
      : saved;
    const controls = defaultControls();
    for (const color of COLORS) {
      const entry = rawControls[color.id];
      if (!entry || typeof entry !== "object") continue;
      const config = entry as { nome?: unknown; code?: unknown };
      controls[color.id] = {
        nome: typeof config.nome === "string" ? config.nome : color.name,
        code: typeof config.code === "number" && Number.isFinite(config.code) ? config.code : null,
      };
    }
    const rawTopics = Array.isArray(saved.topics) ? saved.topics : [];
    const topics = rawTopics.flatMap((item): DebateTopic[] => {
      if (!item || typeof item !== "object") return [];
      const topic = item as Partial<DebateTopic>;
      if (typeof topic.id !== "string" || typeof topic.title !== "string") return [];
      return [{
        id: topic.id,
        title: topic.title,
        waiting: Array.isArray(topic.waiting) ? topic.waiting.filter((id): id is string => typeof id === "string" && COLORS.some((color) => color.id === id)) : [],
        currentSpeaker: typeof topic.currentSpeaker === "string" && COLORS.some((color) => color.id === topic.currentSpeaker) ? topic.currentSpeaker : null,
        history: Array.isArray(topic.history) ? topic.history.flatMap((record): SpeechRecord[] => {
          if (!record || typeof record !== "object") return [];
          const speech = record as Partial<SpeechRecord>;
          return typeof speech.id === "string" && typeof speech.durationSeconds === "number" && typeof speech.finishedAt === "number"
            ? [{ id: speech.id, durationSeconds: speech.durationSeconds, finishedAt: speech.finishedAt }]
            : [];
        }) : [],
        remainingSeconds: typeof topic.remainingSeconds === "number" && Number.isFinite(topic.remainingSeconds) ? Math.max(0, topic.remainingSeconds) : 90,
      }];
    });
    const safeTopics = topics.length ? topics : defaults.topics;
    const requestedActiveId = typeof saved.activeTopicId === "string" ? saved.activeTopicId : safeTopics[0].id;
    const activeTopicId = safeTopics.some((topic) => topic.id === requestedActiveId) ? requestedActiveId : safeTopics[0].id;
    return {
      controls,
      topics: safeTopics,
      activeTopicId,
      defaultDuration: typeof saved.defaultDuration === "number" && Number.isFinite(saved.defaultDuration) ? Math.min(3600, Math.max(1, saved.defaultDuration)) : 90,
    };
  } catch {
    return defaults;
  }
}

export function readRawSession() { return localStorage.getItem(SESSION_KEY) ?? ""; }
export function readServerSnapshot() { return ""; }
export function subscribeSession(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  if (!localStorage.getItem(SESSION_KEY)) {
    const oldControls = localStorage.getItem("fila-controles:v1");
    if (oldControls) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(parseSession(oldControls)));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  }
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
export function writeSession(update: (session: DebateSession) => DebateSession) {
  const current = parseSession(readRawSession());
  localStorage.setItem(SESSION_KEY, JSON.stringify(update(current)));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
