"use client";

import { useCallback } from "react";
import { createTopic } from "./sessionStore";
import { useSession } from "./useSession";

export function useTopics() {
  const { session, update } = useSession();
  const activeTopic = session.topics.find((topic) => topic.id === session.activeTopicId) ?? session.topics[0];

  const selectTopic = useCallback((id: string) => update((current) => {
    const previous = current.topics.find((topic) => topic.id === current.activeTopicId);
    const hadSpeaker = Boolean(previous?.currentSpeaker);
    const topics = current.topics.map((topic) => {
      if (topic.id !== current.activeTopicId || !topic.currentSpeaker) return topic;
      return {
        ...topic,
        currentSpeaker: null,
        history: [...topic.history, { id: topic.currentSpeaker, durationSeconds: Math.max(0, current.defaultDuration - topic.remainingSeconds), finishedAt: Date.now() }],
      };
    }).map((topic) => topic.id === id && hadSpeaker ? { ...topic, remainingSeconds: current.defaultDuration } : topic);
    return { ...current, topics, activeTopicId: id };
  }), [update]);

  const create = useCallback((title: string) => {
    const topic = { ...createTopic(title), remainingSeconds: session.defaultDuration };
    update((current) => ({
      ...current,
      topics: [...current.topics.map((previous) => previous.id === current.activeTopicId && previous.currentSpeaker ? {
        ...previous,
        currentSpeaker: null,
        history: [...previous.history, { id: previous.currentSpeaker, durationSeconds: Math.max(0, current.defaultDuration - previous.remainingSeconds), finishedAt: Date.now() }],
      } : previous), topic],
      activeTopicId: topic.id,
    }));
  }, [session.defaultDuration, update]);
  const rename = useCallback((id: string, title: string) => update((current) => ({
    ...current,
    topics: current.topics.map((topic) => topic.id === id ? { ...topic, title } : topic),
  })), [update]);
  const remove = useCallback((id: string) => update((current) => {
    if (current.topics.length <= 1) return current;
    const topics = current.topics.filter((topic) => topic.id !== id);
    return { ...current, topics, activeTopicId: current.activeTopicId === id ? topics[0].id : current.activeTopicId };
  }), [update]);
  const setDefaultDuration = useCallback((seconds: number) => update((current) => ({
    ...current,
    defaultDuration: Math.min(3600, Math.max(1, Math.floor(seconds))),
  })), [update]);

  return { topics: session.topics, activeTopic, activeTopicId: session.activeTopicId, defaultDuration: session.defaultDuration, selectTopic, create, rename, remove, setDefaultDuration, update };
}
