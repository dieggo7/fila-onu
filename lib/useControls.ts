"use client";

import { useCallback } from "react";
import { useSession } from "./useSession";

export type ControlConfig = { nome: string; code: number | null };
export type ControlConfigs = Record<string, ControlConfig>;

export function useControls() {
  const { session, update } = useSession();
  const rename = useCallback((id: string, nome: string) => update((current) => ({
    ...current,
    controls: { ...current.controls, [id]: { ...current.controls[id], nome } },
  })), [update]);
  const bindCode = useCallback((id: string, code: number) => update((current) => {
    const controls = { ...current.controls };
    for (const key of Object.keys(controls)) if (controls[key].code === code) controls[key] = { ...controls[key], code: null };
    controls[id] = { ...controls[id], code };
    return { ...current, controls };
  }), [update]);
  return { controls: session.controls, rename, bindCode };
}
