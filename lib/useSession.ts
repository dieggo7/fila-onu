"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  parseSession,
  readRawSession,
  readServerSnapshot,
  subscribeSession,
  writeSession,
} from "./sessionStore";

export function useSession() {
  const snapshot = useSyncExternalStore(
    subscribeSession,
    readRawSession,
    readServerSnapshot,
  );
  const session = parseSession(snapshot);
  const update = useCallback(
    (change: Parameters<typeof writeSession>[0]) => writeSession(change),
    [],
  );
  return { session, update };
}
