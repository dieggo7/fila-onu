"use client";

import { useSession } from "./useSession";

export function useSpeechLog() {
  const { session } = useSession();
  return { records: session.speechLog, session };
}
