import { COLORS } from "./colors";
import type { SpeechRecord } from "@/types";

export type DebateTopic = {
  id: string;
  title: string;
  waiting: string[];
  currentSpeaker: string | null;
  currentSpeakerStartedAt: number | null;
  currentSpeakerTimerStarted: boolean;
  currentSpeakerTimerInitialSec: number | null;
  currentSpeakerAllottedSec: number | null;
  remainingSeconds: number;
};
export type DebateSession = {
  controls: Record<string, { nome: string; code: number | null }>;
  topics: DebateTopic[];
  activeTopicId: string;
  defaultDuration: number;
  speechLog: SpeechRecord[];
};

export const SESSION_KEY = "fila-controles:v3";
export const STORAGE_ERROR_EVENT = "fila-storage-error";
const CHANGE_EVENT = "fila-session-change";
let memorySnapshot = "";

function defaultControls() {
  return Object.fromEntries(
    COLORS.map((color) => [
      color.id,
      { nome: color.name, code: null as number | null },
    ]),
  );
}

export function createTopic(title = "Tópico 1"): DebateTopic {
  return {
    id: crypto.randomUUID(),
    title,
    waiting: [],
    currentSpeaker: null,
    currentSpeakerStartedAt: null,
    currentSpeakerTimerStarted: false,
    currentSpeakerTimerInitialSec: null,
    currentSpeakerAllottedSec: null,
    remainingSeconds: 120,
  };
}

export function defaultSession(): DebateSession {
  const topic: DebateTopic = {
    id: "topic-1",
    title: "Tópico 1",
    waiting: [],
    currentSpeaker: null,
    currentSpeakerStartedAt: null,
    currentSpeakerTimerStarted: false,
    currentSpeakerTimerInitialSec: null,
    currentSpeakerAllottedSec: null,
    remainingSeconds: 120,
  };
  return {
    controls: defaultControls(),
    topics: [topic],
    activeTopicId: topic.id,
    defaultDuration: 120,
    speechLog: [],
  };
}

function numeric(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function parseSpeechLog(value: unknown): SpeechRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SpeechRecord[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Partial<SpeechRecord>;
    if (
      typeof record.id !== "string" ||
      typeof record.topicId !== "string" ||
      !Number.isInteger(record.delegationId) ||
      (record.delegationId ?? 0) < 1 ||
      (record.delegationId ?? 0) > COLORS.length ||
      typeof record.startedAt !== "number" ||
      !Number.isFinite(record.startedAt) ||
      !(record.durationSec === null ||
        (typeof record.durationSec === "number" &&
          Number.isFinite(record.durationSec))) ||
      typeof record.allottedSec !== "number" ||
      !Number.isFinite(record.allottedSec)
    ) return [];
    return [record as SpeechRecord];
  });
}

function migrateLegacyHistory(topics: unknown[]): SpeechRecord[] {
  return topics.flatMap((item, topicIndex): SpeechRecord[] => {
    if (!item || typeof item !== "object") return [];
    const topic = item as { id?: unknown; history?: unknown };
    if (typeof topic.id !== "string" || !Array.isArray(topic.history)) return [];
    const topicId = topic.id;
    return topic.history.flatMap((entry, historyIndex): SpeechRecord[] => {
      if (!entry || typeof entry !== "object") return [];
      const speech = entry as { id?: unknown; finishedAt?: unknown };
      const delegationId = COLORS.findIndex((color) => color.id === speech.id) + 1;
      if (delegationId < 1) return [];
      return [{
        id: `migrated-${topicIndex}-${historyIndex}`,
        topicId,
        delegationId,
        startedAt: numeric(speech.finishedAt, 0),
        durationSec: null,
        allottedSec: 120,
      }];
    });
  });
}

export function parseSession(raw: string): DebateSession {
  const defaults = defaultSession();
  if (!raw) return defaults;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return defaults;
    const saved = value as Record<string, unknown>;
    const oldControls =
      saved.controls && typeof saved.controls === "object"
        ? (saved.controls as Record<string, unknown>)
        : saved;
    const controls = defaultControls();
    for (const color of COLORS) {
      const entry = oldControls[color.id];
      if (!entry || typeof entry !== "object") continue;
      const config = entry as { nome?: unknown; code?: unknown };
      controls[color.id] = {
        nome: typeof config.nome === "string" ? config.nome : color.name,
        code:
          typeof config.code === "number" && Number.isFinite(config.code)
            ? config.code
            : null,
      };
    }

    const defaultDuration = Math.min(
      3600,
      Math.max(1, numeric(saved.defaultDuration, 120) === 90
        ? 120
        : numeric(saved.defaultDuration, 120)),
    );
    const rawTopics = Array.isArray(saved.topics) ? saved.topics : [];
    const topics = rawTopics.flatMap((item): DebateTopic[] => {
      if (!item || typeof item !== "object") return [];
      const topic = item as Record<string, unknown>;
      if (typeof topic.id !== "string" || typeof topic.title !== "string")
        return [];
      const currentSpeaker =
        typeof topic.currentSpeaker === "string" &&
        COLORS.some((color) => color.id === topic.currentSpeaker)
          ? topic.currentSpeaker
          : null;
      return [{
        id: topic.id,
        title: topic.title,
        waiting: Array.isArray(topic.waiting)
          ? topic.waiting.filter(
              (id): id is string =>
                typeof id === "string" &&
                COLORS.some((color) => color.id === id),
            )
          : [],
        currentSpeaker,
        currentSpeakerStartedAt:
          typeof topic.currentSpeakerStartedAt === "number" &&
          Number.isFinite(topic.currentSpeakerStartedAt)
            ? topic.currentSpeakerStartedAt
            : null,
        currentSpeakerTimerStarted: topic.currentSpeakerTimerStarted === true,
        currentSpeakerTimerInitialSec:
          typeof topic.currentSpeakerTimerInitialSec === "number" && Number.isFinite(topic.currentSpeakerTimerInitialSec)
            ? topic.currentSpeakerTimerInitialSec
            : null,
        currentSpeakerAllottedSec:
          typeof topic.currentSpeakerAllottedSec === "number" &&
          Number.isFinite(topic.currentSpeakerAllottedSec)
            ? topic.currentSpeakerAllottedSec
            : currentSpeaker
              ? defaultDuration
              : null,
        remainingSeconds: numeric(topic.remainingSeconds, defaultDuration),
      }];
    });
    const safeTopics = topics.length ? topics : defaults.topics;
    const requestedActiveId =
      typeof saved.activeTopicId === "string"
        ? saved.activeTopicId
        : safeTopics[0].id;
    const activeTopicId = safeTopics.some(
      (topic) => topic.id === requestedActiveId,
    )
      ? requestedActiveId
      : safeTopics[0].id;
    const storedLog = parseSpeechLog(saved.speechLog);
    const legacyLog = migrateLegacyHistory(rawTopics);
    const knownTopicIds = new Set(safeTopics.map((topic) => topic.id));
    return {
      controls,
      topics: safeTopics,
      activeTopicId,
      defaultDuration,
      speechLog: [...legacyLog, ...storedLog].filter((speech) =>
        knownTopicIds.has(speech.topicId),
      ),
    };
  } catch {
    return defaults;
  }
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function persistRaw(raw: string) {
  try {
    localStorage.setItem(SESSION_KEY, raw);
    memorySnapshot = "";
  } catch {
    memorySnapshot = raw;
    window.dispatchEvent(new Event(STORAGE_ERROR_EVENT));
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readRawSession() {
  return memorySnapshot || safeGet(SESSION_KEY);
}
export function readServerSnapshot() {
  return "";
}
export function subscribeSession(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  if (!safeGet(SESSION_KEY)) {
    const legacy = safeGet("fila-controles:v2") || safeGet("fila-controles:v1");
    if (legacy) persistRaw(JSON.stringify(parseSession(legacy)));
  }
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function writeSession(
  update: (session: DebateSession) => DebateSession,
) {
  const current = parseSession(readRawSession());
  persistRaw(JSON.stringify(update(current)));
}
