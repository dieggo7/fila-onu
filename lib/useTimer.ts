"use client";

import { useCallback, useEffect, useState } from "react";
import { useTopics } from "./useTopics";
import { useSpeakers } from "./useSpeakers";

export function useTimer() {
  const { activeTopicId, defaultDuration, setDefaultDuration } = useTopics();
  const { topic, setRemaining, tick } = useSpeakers();
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
    if (topic.currentSpeaker) setRunningTopicId(activeTopicId);
  }, [activeTopicId, topic.currentSpeaker]);
  const pause = useCallback(() => setRunningTopicId(null), []);
  const restart = useCallback(() => {
    setRunningTopicId(null);
    setRemaining(defaultDuration);
  }, [defaultDuration, setRemaining]);
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
