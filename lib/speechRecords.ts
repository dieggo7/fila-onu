import { COLORS } from "./colors";
import type { DebateTopic } from "./sessionStore";
import type { SpeechRecord } from "@/types";

export function createSpeechRecord(
  topicId: string,
  topic: DebateTopic,
  defaultDuration: number,
  finishedAt: number,
): SpeechRecord | null {
  if (!topic.currentSpeaker) return null;
  const delegationId =
    COLORS.findIndex((color) => color.id === topic.currentSpeaker) + 1;
  if (delegationId < 1) return null;
  const startedAt = topic.currentSpeakerStartedAt ?? finishedAt;
  const allottedSec = topic.currentSpeakerAllottedSec ?? defaultDuration;
  // Use cronômetro após iniciado (incluindo excedente); sem início, mede Chamar → finalizar.
  const durationSec = topic.currentSpeakerStartedAt === null
    ? null
    : topic.currentSpeakerTimerStarted
      ? Math.max(0, (topic.currentSpeakerTimerInitialSec ?? allottedSec) - topic.remainingSeconds)
      : Math.max(0, Math.floor((finishedAt - startedAt) / 1000));
  return {
    id: crypto.randomUUID(),
    topicId,
    delegationId,
    startedAt,
    durationSec,
    allottedSec,
  };
}
