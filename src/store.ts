import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { apply, fold, parseLogs, stamp, type State } from "./domain/state";
import type { Change } from "./domain/types";

export type Config = { dir: string; device: string };

/** Loads the merged state from the sync folder and reloads whenever the app regains focus. */
export function useRegimen() {
  const [config, setConfig] = useState<Config>();
  const [state, setState] = useState<State>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      const config = await invoke<Config>("load_config");
      const logs = await invoke<string[]>("read_logs", { dir: config.dir });
      setConfig(config);
      setState(fold(parseLogs(logs)));
      setError(undefined);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    reload();
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const commit = useCallback(
    async (...changes: Change[]) => {
      if (!config || !state) return;
      const events = changes.map((change) => stamp(change, config.device));
      await invoke("append_events", {
        dir: config.dir,
        device: config.device,
        lines: events.map((event) => JSON.stringify(event)),
      });
      const next = structuredClone(state);
      events.forEach((event) => apply(next, event));
      setState(next);
    },
    [config, state],
  );

  return { config, state, error, reload, commit };
}
