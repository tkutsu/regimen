import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { apply, fold, parseLogs, stamp, type State } from "./domain/state";
import type { Change } from "./domain/types";

/** Where this device keeps the logs and the name of its own log. */
export type Config = { dir: string; device: string };

/**
 * Loads the merged state from the sync folder and reloads whenever the app regains focus.
 * `config` is null on first run, before a folder is chosen.
 */
export function useRegimen() {
  const [config, setConfig] = useState<Config | null>();
  const [state, setState] = useState<State>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      const config = await invoke<Config | null>("load_config");
      setConfig(config);
      if (!config) return;
      const logs = await invoke<string[]>("read_logs", { dir: config.dir });
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

  /** Switching folders reads everything again from the new one. */
  const saveConfig = useCallback(
    async (config: Config) => {
      await invoke("save_config", { config });
      setState(undefined);
      await reload();
    },
    [reload],
  );

  return { config, state, error, reload, commit, saveConfig };
}
