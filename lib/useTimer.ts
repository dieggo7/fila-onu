"use client";

import { useCallback, useEffect, useState } from "react";
import { useTopics } from "./useTopics";
import { useSpeakers } from "./useSpeakers";

export function useTimer() {
  const { activeTopicId, defaultDuration, setDefaultDuration } = useTopics();
  const { topic, setRemaining } = useSpeakers();
  const [runningTopicId, setRunningTopicId] = useState<string | null>(null);
  const running = runningTopicId === activeTopicId && topic.remainingSeconds > 0;
  const remaining = topic.remainingSeconds;
  useEffect(() => {
    if (!running || !topic.currentSpeaker || remaining <= 0) return;
    const interval = window.setInterval(() => setRemaining(remaining - 1), 1000);
    return () => window.clearInterval(interval);
  }, [activeTopicId, remaining, running, setRemaining, topic.currentSpeaker]);

  const start = useCallback(() => { if (topic.currentSpeaker && remaining > 0) setRunningTopicId(activeTopicId); }, [activeTopicId, remaining, topic.currentSpeaker]);
  const pause = useCallback(() => setRunningTopicId(null), []);
  const restart = useCallback(() => {
    setRunningTopicId(null);
    setRemaining(defaultDuration);
  }, [defaultDuration, setRemaining]);
  const setDuration = useCallback((seconds: number) => {
    setDefaultDuration(seconds);
    if (!topic.currentSpeaker || !running) setRemaining(seconds);
  }, [running, setDefaultDuration, setRemaining, topic.currentSpeaker]);
  return { remaining, defaultDuration, running, start, pause, restart, setDuration };
}
