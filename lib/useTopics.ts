"use client";

import { useCallback } from "react";
import { createTopic } from "./sessionStore";
import { useSession } from "./useSession";
import { createSpeechRecord } from "./speechRecords";

export function useTopics() {
  const { session, update } = useSession();
  const activeTopic =
    session.topics.find((topic) => topic.id === session.activeTopicId) ??
    session.topics[0];

  const selectTopic = useCallback(
    (id: string) =>
      update((current) => {
        const finishedAt = Date.now();
        const previous = current.topics.find(
          (topic) => topic.id === current.activeTopicId,
        );
        const record = previous
          ? createSpeechRecord(
              previous.id,
              previous,
              current.defaultDuration,
              finishedAt,
            )
          : null;
        const topics = current.topics
          .map((topic) => {
            if (topic.id !== current.activeTopicId || !topic.currentSpeaker)
              return topic;
            return {
              ...topic,
              currentSpeaker: null,
              currentSpeakerStartedAt: null,
              currentSpeakerTimerStarted: false,
              currentSpeakerTimerInitialSec: null,
              currentSpeakerAllottedSec: null,
            };
          })
          .map((topic) =>
            topic.id === id && record
              ? { ...topic, remainingSeconds: current.defaultDuration }
              : topic,
          );
        return {
          ...current,
          topics,
          activeTopicId: id,
          speechLog: record
            ? [...current.speechLog, record]
            : current.speechLog,
        };
      }),
    [update],
  );

  const create = useCallback(
    (title: string) => {
      const topic = {
        ...createTopic(title),
        remainingSeconds: session.defaultDuration,
      };
      update((current) => {
        const finishedAt = Date.now();
        const previous = current.topics.find(
          (item) => item.id === current.activeTopicId,
        );
        const record = previous
          ? createSpeechRecord(
              previous.id,
              previous,
              current.defaultDuration,
              finishedAt,
            )
          : null;
        return {
          ...current,
          topics: [
            ...current.topics.map((item) =>
              item.id === current.activeTopicId && item.currentSpeaker
                ? {
                    ...item,
                    currentSpeaker: null,
                    currentSpeakerStartedAt: null,
                    currentSpeakerTimerStarted: false,
                    currentSpeakerTimerInitialSec: null,
                    currentSpeakerAllottedSec: null,
                  }
                : item,
            ),
            topic,
          ],
          activeTopicId: topic.id,
          speechLog: record ? [...current.speechLog, record] : current.speechLog,
        };
      });
    },
    [session.defaultDuration, update],
  );
  const rename = useCallback(
    (id: string, title: string) =>
      update((current) => ({
        ...current,
        topics: current.topics.map((topic) =>
          topic.id === id ? { ...topic, title } : topic,
        ),
      })),
    [update],
  );
  const remove = useCallback(
    (id: string) =>
      update((current) => {
        if (current.topics.length <= 1) return current;
        const topics = current.topics.filter((topic) => topic.id !== id);
        return {
          ...current,
          topics,
          speechLog: current.speechLog.filter((speech) => speech.topicId !== id),
          activeTopicId:
            current.activeTopicId === id ? topics[0].id : current.activeTopicId,
        };
      }),
    [update],
  );
  const setDefaultDuration = useCallback(
    (seconds: number) =>
      update((current) => ({
        ...current,
        defaultDuration: Math.min(3600, Math.max(1, Math.floor(seconds))),
      })),
    [update],
  );

  return {
    topics: session.topics,
    activeTopic,
    activeTopicId: session.activeTopicId,
    defaultDuration: session.defaultDuration,
    selectTopic,
    create,
    rename,
    remove,
    setDefaultDuration,
    update,
  };
}
