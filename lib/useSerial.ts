"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbVendorId?: number };
  addEventListener(type: "disconnect", listener: () => void): void;
  removeEventListener(type: "disconnect", listener: () => void): void;
};
type SerialNavigator = Navigator & {
  serial?: {
    getPorts(): Promise<SerialPortLike[]>;
    requestPort(): Promise<SerialPortLike>;
    addEventListener(
      type: "connect",
      listener: (event: { port: SerialPortLike }) => void,
    ): void;
    addEventListener(
      type: "disconnect",
      listener: (event: { port: SerialPortLike }) => void,
    ): void;
    removeEventListener(
      type: "connect",
      listener: (event: { port: SerialPortLike }) => void,
    ): void;
    removeEventListener(
      type: "disconnect",
      listener: (event: { port: SerialPortLike }) => void,
    ): void;
  };
};
type SerialCallbacks = {
  onCode: (code: number) => void;
};
export type SerialStatus = "searching" | "connected" | "disconnected" | "busy";

const ESP_VENDOR_IDS = new Set([0x10c4, 0x1a86, 0x0403]);

function serialSupported() {
  return "serial" in navigator;
}
function serverSerialSupported() {
  return true;
}
function subscribeToSupport() {
  return () => undefined;
}

function chooseAuthorizedPort(ports: SerialPortLike[]) {
  if (ports.length === 1) return ports[0] ?? null;
  const preferred = ports.filter((port) =>
    ESP_VENDOR_IDS.has(port.getInfo().usbVendorId ?? -1),
  );
  return preferred.length === 1 ? preferred[0] : null;
}

function isPortBusy(cause: unknown) {
  if (!(cause instanceof Error)) return false;
  return (
    cause.name === "NetworkError" ||
    /in use|busy|locked|access is denied/i.test(cause.message)
  );
}

export function useSerial(
  onCode: (code: number) => void,
) {
  const [status, setStatus] = useState<SerialStatus>("searching");
  const [manualAvailable, setManualAvailable] = useState(false);
  const supported = useSyncExternalStore(
    subscribeToSupport,
    serialSupported,
    serverSerialSupported,
  );
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const portRef = useRef<SerialPortLike | null>(null);
  const openingPortRef = useRef<SerialPortLike | null>(null);
  const lifecycleRef = useRef(0);
  const aliveRef = useRef(false);
  const callbacksRef = useRef<SerialCallbacks>({ onCode });
  const activeDisconnectHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    callbacksRef.current = { onCode };
  }, [onCode]);

  const connectPort = useCallback(async (port: SerialPortLike, lifecycle: number) => {
    if (
      lifecycle !== lifecycleRef.current ||
      portRef.current ||
      openingPortRef.current
    ) return;

    openingPortRef.current = port;
    setManualAvailable(false);
    setStatus("searching");
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let disconnectHandler: (() => void) | null = null;
    let opened = false;
    try {
      await port.open({ baudRate: 115200 });
      opened = true;
      if (!aliveRef.current || lifecycle !== lifecycleRef.current) {
        await port.close();
        return;
      }
      portRef.current = port;
      if (openingPortRef.current === port) openingPortRef.current = null;
      setStatus("connected");

      disconnectHandler = () => {
        if (portRef.current !== port) return;
        portRef.current = null;
        setStatus("disconnected");
        void readerRef.current?.cancel().catch(() => undefined);
      };
      activeDisconnectHandlerRef.current = disconnectHandler;
      port.addEventListener("disconnect", disconnectHandler);

      reader = port.readable?.getReader() ?? null;
      if (!reader) throw new Error("A porta conectou sem liberar a leitura.");
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";
      while (aliveRef.current && lifecycle === lifecycleRef.current && portRef.current === port) {
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
      if (
        aliveRef.current &&
        lifecycle === lifecycleRef.current &&
        (!opened || portRef.current === port)
      ) {
        setStatus(isPortBusy(cause) ? "busy" : "disconnected");
      }
    } finally {
      const wasOpeningPort = openingPortRef.current === port;
      if (wasOpeningPort) openingPortRef.current = null;
      if (reader) {
        if (readerRef.current === reader) readerRef.current = null;
        try { reader.releaseLock(); } catch { /* O leitor pode já estar liberado. */ }
      }
      if (disconnectHandler) {
        port.removeEventListener("disconnect", disconnectHandler);
        if (activeDisconnectHandlerRef.current === disconnectHandler) {
          activeDisconnectHandlerRef.current = null;
        }
      }
      if (portRef.current === port) {
        portRef.current = null;
        if (aliveRef.current && lifecycle === lifecycleRef.current) {
          setStatus("disconnected");
        }
        try { await port.close(); } catch { /* A porta pode ter sido removida. */ }
      }
    }
  }, []);

  const chooseManually = useCallback(async () => {
    const serial = (navigator as SerialNavigator).serial;
    if (!serial || portRef.current || openingPortRef.current) return;
    setStatus("searching");
    try {
      const port = await serial.requestPort();
      setManualAvailable(false);
      await connectPort(port, lifecycleRef.current);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "NotFoundError") {
        setStatus("disconnected");
        return;
      }
      setStatus(isPortBusy(cause) ? "busy" : "disconnected");
    }
  }, [connectPort]);

  useEffect(() => {
    const serial = (navigator as SerialNavigator).serial;
    if (!serial) return;
    aliveRef.current = true;
    const lifecycle = ++lifecycleRef.current;

    const handleConnect = (event: { port: SerialPortLike }) => {
      if (portRef.current || openingPortRef.current) return;
      setStatus("searching");
      void serial.getPorts().then((ports) => {
        if (lifecycle !== lifecycleRef.current) return;
        const selected = chooseAuthorizedPort(ports) ??
          (ports.length <= 1 ? event.port : null);
        if (!selected) {
          setManualAvailable(true);
          setStatus("disconnected");
          return;
        }
        void connectPort(selected, lifecycle);
      }).catch(() => {
        if (lifecycle === lifecycleRef.current) setStatus("disconnected");
      });
    };
    const handleSerialDisconnect = (event: { port: SerialPortLike }) => {
      if (portRef.current === event.port) {
        portRef.current = null;
        setStatus("disconnected");
        void readerRef.current?.cancel().catch(() => undefined);
        return;
      }
      if (!portRef.current) {
        setStatus((current) => current === "busy" ? "disconnected" : current);
      }
    };

    void serial.getPorts().then((ports) => {
      if (lifecycle !== lifecycleRef.current) return;
      const port = chooseAuthorizedPort(ports);
      if (!port) {
        setManualAvailable(true);
        setStatus("disconnected");
        return;
      }
      setManualAvailable(false);
      void connectPort(port, lifecycle);
    }).catch(() => {
      if (lifecycle === lifecycleRef.current) {
        setManualAvailable(true);
        setStatus("disconnected");
      }
    });
    serial.addEventListener("connect", handleConnect);
    serial.addEventListener("disconnect", handleSerialDisconnect);

    return () => {
      aliveRef.current = false;
      lifecycleRef.current += 1;
      serial.removeEventListener("connect", handleConnect);
      serial.removeEventListener("disconnect", handleSerialDisconnect);
      const port = portRef.current;
      const reader = readerRef.current;
      portRef.current = null;
      readerRef.current = null;
      if (port && activeDisconnectHandlerRef.current) {
        port.removeEventListener("disconnect", activeDisconnectHandlerRef.current);
        activeDisconnectHandlerRef.current = null;
      }
      if (reader) {
        void reader.cancel().catch(() => undefined).finally(() => {
          try { reader.releaseLock(); } catch { /* O leitor já foi liberado. */ }
        });
      }
      if (port) void port.close().catch(() => undefined);
    };
  }, [connectPort]);

  return { supported, status, manualAvailable, chooseManually };
}
