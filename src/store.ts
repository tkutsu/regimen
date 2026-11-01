import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { apply, fold, parseLogs, stamp, type State } from "./domain/state";
import type { Change } from "./domain/types";

/** Where this device keeps the logs and the name of its own log. */
export type Config = { dir: string; device: string };

/** A device's check-in: where it keeps the folder and when it last opened the app (Unix seconds). */
export type Device = { name: string; platform: "desktop" | "mobile"; dir: string; seen: number };

/** Who syncs this folder, and whether Syncthing shares it here (null when unknown, on Android). */
export type Peers = { devices: Device[]; synced: boolean | null };

type Loaded = Peers & { logs: string[] };

/**
 * Loads the merged state from the sync folder and reloads whenever the app regains focus.
 * Opening also checks this device in, so the others see it syncing.
 * `config` is null on first run, before a folder is chosen.
 */
export function useRegimen() {
  const [config, setConfig] = useState<Config | null>();
  const [state, setState] = useState<State>();
  const [peers, setPeers] = useState<Peers>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      const config = await invoke<Config | null>("load_config");
      setConfig(config);
      if (!config) return;
      const { logs, ...peers } = await invoke<Loaded>("load_folder", { dir: config.dir, device: config.device });
      setState(fold(parseLogs(logs)));
      setPeers(peers);
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

  /** Switching folders reads everything again from the new one. A new name takes this device's log with it. */
  const saveConfig = useCallback(
    async (next: Config) => {
      if (config && config.device !== next.device) await invoke("rename_device", { dir: next.dir, from: config.device, to: next.device });
      await invoke("save_config", { config: next });
      setState(undefined);
      await reload();
    },
    [config, reload],
  );

  return { config, state, peers, error, reload, commit, saveConfig };
}
