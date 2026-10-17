"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: "disconnect", listener: () => void): void;
  removeEventListener(type: "disconnect", listener: () => void): void;
};
type SerialNavigator = Navigator & { serial?: { requestPort(): Promise<SerialPortLike> } };
type SerialCallbacks = { onCode: (code: number) => void; onError: (message: string) => void; onDisconnect: () => void };

function serialSupported() { return "serial" in navigator; }
function serverSerialSupported() { return true; }
function subscribeToSupport() { return () => undefined; }

export function useSerial(onCode: (code: number) => void, onError: (message: string) => void, onDisconnect: () => void) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const supported = useSyncExternalStore(subscribeToSupport, serialSupported, serverSerialSupported);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const portRef = useRef<SerialPortLike | null>(null);
  const aliveRef = useRef(true);
  const callbacksRef = useRef<SerialCallbacks>({ onCode, onError, onDisconnect });
  const disconnectRef = useRef<() => Promise<void>>(async () => undefined);
  const handlerRef = useRef<() => void>(() => undefined);

  useEffect(() => { callbacksRef.current = { onCode, onError, onDisconnect }; }, [onCode, onError, onDisconnect]);

  const disconnect = useCallback(async () => {
    const reader = readerRef.current;
    const port = portRef.current;
    readerRef.current = null;
    portRef.current = null;
    if (reader) {
      try { await reader.cancel(); } catch { /* A porta pode ter sido removida. */ }
      try { reader.releaseLock(); } catch { /* O loop pode já ter liberado o leitor. */ }
    }
    if (port) {
      port.removeEventListener("disconnect", handlerRef.current);
      try { await port.close(); } catch { /* A porta pode já estar fechada. */ }
    }
    if (aliveRef.current) setConnected(false);
  }, []);
  const handleDisconnect = useCallback(() => {
    callbacksRef.current.onDisconnect();
    void disconnectRef.current();
  }, []);

  const connect = useCallback(async () => {
    const serial = (navigator as SerialNavigator).serial;
    if (!serial) return;
    if (portRef.current) return;
    setError("");
    try {
      const port = await serial.requestPort();
      if (!aliveRef.current) return;
      await port.open({ baudRate: 115200 });
      if (!aliveRef.current) { await port.close(); return; }
      portRef.current = port;
      port.addEventListener("disconnect", handlerRef.current);
      setConnected(true);
      const reader = port.readable?.getReader();
      if (!reader) throw new Error("A porta serial não está disponível para leitura.");
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";
      while (aliveRef.current && portRef.current === port) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const match = /^CODE,\s*(-?\d+),\s*\d+\s*$/.exec(line.trim());
          if (match) callbacksRef.current.onCode(Number(match[1]));
        }
      }
    } catch (cause) {
      if (aliveRef.current && !(cause instanceof DOMException && cause.name === "NotFoundError")) {
        const message = cause instanceof Error ? cause.message : "Não foi possível conectar ao ESP32.";
        setError(message);
        callbacksRef.current.onError(message);
      }
    } finally {
      if (aliveRef.current) await disconnectRef.current();
    }
  }, []);

  useEffect(() => {
    disconnectRef.current = disconnect;
    handlerRef.current = handleDisconnect;
  }, [disconnect, handleDisconnect]);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; void disconnectRef.current(); };
  }, []);
  return { connected, supported, error, connect, disconnect };
}
