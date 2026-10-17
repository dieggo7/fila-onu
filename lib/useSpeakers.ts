"use client";

import { useCallback } from "react";
import type { DebateTopic } from "./sessionStore";
import { useTopics } from "./useTopics";

export type UndoChange = { label: string; undo: () => void };

export function useSpeakers() {
  const { activeTopic, activeTopicId, defaultDuration, update } = useTopics();
  const editTopic = useCallback((topicId: string, edit: (topic: DebateTopic) => DebateTopic) => update((session) => ({
    ...session,
    topics: session.topics.map((topic) => topic.id === topicId ? edit(topic) : topic),
  })), [update]);
  const enroll = useCallback((id: string) => editTopic(activeTopicId, (topic) => {
    if (topic.currentSpeaker === id || topic.waiting.includes(id)) return topic;
    return { ...topic, waiting: [...topic.waiting, id] };
  }), [activeTopicId, editTopic]);

  const call = useCallback((id: string) => editTopic(activeTopicId, (topic) => {
    const waiting = topic.waiting.filter((speaker) => speaker !== id);
    const history = topic.currentSpeaker
      ? [...topic.history, { id: topic.currentSpeaker, durationSeconds: Math.max(0, defaultDuration - topic.remainingSeconds), finishedAt: Date.now() }]
      : topic.history;
    return { ...topic, waiting, currentSpeaker: id, remainingSeconds: defaultDuration, history };
  }), [activeTopicId, defaultDuration, editTopic]);

  const finish = useCallback((): UndoChange | null => {
    if (!activeTopic.currentSpeaker) return null;
    const speakerId = activeTopic.currentSpeaker;
    const finishedAt = Date.now();
    const previousRemaining = activeTopic.remainingSeconds;
    editTopic(activeTopicId, (topic) => ({
      ...topic,
      currentSpeaker: null,
      history: [...topic.history, { id: speakerId, durationSeconds: Math.max(0, defaultDuration - topic.remainingSeconds), finishedAt }],
      remainingSeconds: defaultDuration,
    }));
    return { label: "Fala finalizada", undo: () => editTopic(activeTopicId, (topic) => ({
      ...topic,
      currentSpeaker: topic.currentSpeaker ?? speakerId,
      remainingSeconds: previousRemaining,
      history: topic.history.filter((speech) => speech.id !== speakerId || speech.finishedAt !== finishedAt),
    })) };
  }, [activeTopic, activeTopicId, defaultDuration, editTopic]);

  const remove = useCallback((id: string): UndoChange => {
    const previousIndex = activeTopic.waiting.indexOf(id);
    editTopic(activeTopicId, (topic) => ({ ...topic, waiting: topic.waiting.filter((speaker) => speaker !== id) }));
    return { label: "Orador removido da lista", undo: () => editTopic(activeTopicId, (topic) => topic.waiting.includes(id) ? topic : {
      ...topic,
      waiting: [...topic.waiting.slice(0, previousIndex), id, ...topic.waiting.slice(previousIndex)],
    }) };
  }, [activeTopic, activeTopicId, editTopic]);

  const move = useCallback((id: string, direction: -1 | 1) => editTopic(activeTopicId, (topic) => {
    const index = topic.waiting.indexOf(id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= topic.waiting.length) return topic;
    const waiting = [...topic.waiting];
    [waiting[index], waiting[targetIndex]] = [waiting[targetIndex], waiting[index]];
    return { ...topic, waiting };
  }), [activeTopicId, editTopic]);

  const setRemaining = useCallback((seconds: number) => editTopic(activeTopicId, (topic) => ({ ...topic, remainingSeconds: Math.max(0, seconds) })), [activeTopicId, editTopic]);
  const tick = useCallback(() => editTopic(activeTopicId, (topic) => ({ ...topic, remainingSeconds: topic.remainingSeconds - 1 })), [activeTopicId, editTopic]);
  return { topic: activeTopic, enroll, call, finish, remove, move, setRemaining, tick };
}
