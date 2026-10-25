"use client";

import { useCallback } from "react";
import type { DebateTopic } from "./sessionStore";
import { useTopics } from "./useTopics";
import { createSpeechRecord } from "./speechRecords";

export type UndoChange = { label: string; undo: () => void };

export function useSpeakers() {
  const { activeTopic, activeTopicId, defaultDuration, update } = useTopics();
  const editTopic = useCallback(
    (topicId: string, edit: (topic: DebateTopic) => DebateTopic) =>
      update((session) => ({
        ...session,
        topics: session.topics.map((topic) =>
          topic.id === topicId ? edit(topic) : topic,
        ),
      })),
    [update],
  );
  const enroll = useCallback(
    (id: string) =>
      editTopic(activeTopicId, (topic) => {
        if (topic.currentSpeaker === id || topic.waiting.includes(id))
          return topic;
        return { ...topic, waiting: [...topic.waiting, id] };
      }),
    [activeTopicId, editTopic],
  );

  const call = useCallback(
    (id: string) =>
      update((session) => {
        const current = session.topics.find(
          (topic) => topic.id === activeTopicId,
        );
        if (!current) return session;
        const finishedAt = Date.now();
        const record = createSpeechRecord(
          activeTopicId,
          current,
          defaultDuration,
          finishedAt,
        );
        return {
          ...session,
          topics: session.topics.map((topic) =>
            topic.id === activeTopicId
              ? {
                  ...topic,
                  waiting: topic.waiting.filter((speaker) => speaker !== id),
                  currentSpeaker: id,
                  currentSpeakerStartedAt: finishedAt,
                  currentSpeakerTimerStarted: false,
                  currentSpeakerTimerInitialSec: null,
                  currentSpeakerAllottedSec: defaultDuration,
                  remainingSeconds: defaultDuration,
                }
              : topic,
          ),
          speechLog: record ? [...session.speechLog, record] : session.speechLog,
        };
      }),
    [activeTopicId, defaultDuration, update],
  );

  const finish = useCallback((): UndoChange | null => {
    if (!activeTopic.currentSpeaker) return null;
    const speakerId = activeTopic.currentSpeaker;
    const finishedAt = Date.now();
    const previousRemaining = activeTopic.remainingSeconds;
    const record = createSpeechRecord(
      activeTopicId,
      activeTopic,
      defaultDuration,
      finishedAt,
    );
    if (!record) return null;
    update((session) => ({
      ...session,
      topics: session.topics.map((topic) =>
        topic.id === activeTopicId
          ? {
              ...topic,
              currentSpeaker: null,
              currentSpeakerStartedAt: null,
              currentSpeakerTimerStarted: false,
              currentSpeakerTimerInitialSec: null,
              currentSpeakerAllottedSec: null,
              remainingSeconds: defaultDuration,
            }
          : topic,
      ),
      speechLog: [...session.speechLog, record],
    }));
    return {
      label: "Fala finalizada",
      undo: () =>
        update((session) => ({
          ...session,
          topics: session.topics.map((topic) =>
            topic.id === activeTopicId
              ? {
                  ...topic,
                  currentSpeaker: topic.currentSpeaker ?? speakerId,
                  currentSpeakerStartedAt: activeTopic.currentSpeakerStartedAt,
                  currentSpeakerTimerStarted: activeTopic.currentSpeakerTimerStarted,
                  currentSpeakerTimerInitialSec: activeTopic.currentSpeakerTimerInitialSec,
                  currentSpeakerAllottedSec: activeTopic.currentSpeakerAllottedSec,
                  remainingSeconds: previousRemaining,
                }
              : topic,
          ),
          speechLog: session.speechLog.filter(
            (speech) => speech.id !== record.id,
          ),
        })),
    };
  }, [activeTopic, activeTopicId, defaultDuration, update]);

  const remove = useCallback(
    (id: string): UndoChange => {
      const previousIndex = activeTopic.waiting.indexOf(id);
      editTopic(activeTopicId, (topic) => ({
        ...topic,
        waiting: topic.waiting.filter((speaker) => speaker !== id),
      }));
      return {
        label: "Orador removido da lista",
        undo: () =>
          editTopic(activeTopicId, (topic) =>
            topic.waiting.includes(id)
              ? topic
              : {
                  ...topic,
                  waiting: [
                    ...topic.waiting.slice(0, previousIndex),
                    id,
                    ...topic.waiting.slice(previousIndex),
                  ],
                },
          ),
      };
    },
    [activeTopic, activeTopicId, editTopic],
  );

  const move = useCallback(
    (id: string, direction: -1 | 1) =>
      editTopic(activeTopicId, (topic) => {
        const index = topic.waiting.indexOf(id);
        const targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= topic.waiting.length)
          return topic;
        const waiting = [...topic.waiting];
        [waiting[index], waiting[targetIndex]] = [
          waiting[targetIndex],
          waiting[index],
        ];
        return { ...topic, waiting };
      }),
    [activeTopicId, editTopic],
  );

  const setRemaining = useCallback(
    (seconds: number) =>
      editTopic(activeTopicId, (topic) => ({
        ...topic,
        remainingSeconds: Math.max(0, seconds),
      })),
    [activeTopicId, editTopic],
  );
  const markTimerStarted = useCallback(
    (initialSeconds: number, markStarted = true) => editTopic(activeTopicId, (topic) =>
      topic.currentSpeaker
        ? { ...topic, currentSpeakerTimerStarted: topic.currentSpeakerTimerStarted || markStarted, currentSpeakerTimerInitialSec: initialSeconds }
        : topic,
    ),
    [activeTopicId, editTopic],
  );
  const tick = useCallback(
    () =>
      editTopic(activeTopicId, (topic) => ({
        ...topic,
        remainingSeconds: topic.remainingSeconds - 1,
      })),
    [activeTopicId, editTopic],
  );
  return {
    topic: activeTopic,
    enroll,
    call,
    finish,
    remove,
    move,
    setRemaining,
    markTimerStarted,
    tick,
  };
}
