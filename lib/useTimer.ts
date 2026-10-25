"use client";

import { useCallback, useEffect, useState } from "react";
import { useTopics } from "./useTopics";
import { useSpeakers } from "./useSpeakers";

export function useTimer() {
  const { activeTopicId, defaultDuration, setDefaultDuration } = useTopics();
  const { topic, setRemaining, tick, markTimerStarted } = useSpeakers();
  const [runningTopicId, setRunningTopicId] = useState<string | null>(null);
  const running =
    runningTopicId === activeTopicId && Boolean(topic.currentSpeaker);
  const remaining = topic.remainingSeconds;
  useEffect(() => {
    if (!running || !topic.currentSpeaker) return;
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [activeTopicId, remaining, running, tick, topic.currentSpeaker]);

  const start = useCallback(() => {
    if (topic.currentSpeaker) {
      markTimerStarted(topic.remainingSeconds);
      setRunningTopicId(activeTopicId);
    }
  }, [activeTopicId, markTimerStarted, topic.currentSpeaker, topic.remainingSeconds]);
  const pause = useCallback(() => setRunningTopicId(null), []);
  const restart = useCallback(() => {
    setRunningTopicId(null);
    setRemaining(defaultDuration);
    markTimerStarted(defaultDuration, false);
  }, [defaultDuration, markTimerStarted, setRemaining]);
  const setDuration = useCallback(
    (seconds: number) => {
      setDefaultDuration(seconds);
      if (!topic.currentSpeaker || !running) setRemaining(seconds);
    },
    [running, setDefaultDuration, setRemaining, topic.currentSpeaker],
  );
  return {
    remaining,
    defaultDuration,
    running,
    start,
    pause,
    restart,
    setDuration,
  };
}
