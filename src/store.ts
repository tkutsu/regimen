import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { apply, fold, parseLogs, stamp, type State } from "./domain/state";
import type { Change } from "./domain/types";

/** Where this device keeps the logs and the name of its own log. */
export type Config = { dir: string; device: string };

/** A device's check-in: where it keeps the folder and when it last opened the app (Unix seconds). */
export type Device = { name: string; platform: "desktop" | "mobile"; dir: string; seen: number };

/** Who syncs this folder, and whether Syncthing shares it here (null when unknown, on Android). */
export type Peers = { devices: Device[]; synced: boolean | null };

type Loaded = Peers & { logs: string[]; fingerprint: string };

/** How often a visible app checks whether another device's log changed. */
const POLL_MS = 20_000;

/**
 * Loads the merged state from the sync folder and keeps it current. Opening the app (or
 * coming back to it) reads everything and checks this device in. Focusing the window, and
 * every 20 s while it's visible, only compares the logs' fingerprints (names, sizes, change
 * times) and reads them again when one changed.
 * `config` is null on first run, before a folder is chosen.
 */
export function useRegimen() {
  const [config, setConfig] = useState<Config | null>();
  const [state, setState] = useState<State>();
  const [peers, setPeers] = useState<Peers>();
  const [error, setError] = useState<string>();
  const loaded = useRef<{ dir: string; fingerprint: string }>(undefined);

  const reload = useCallback(async (checkIn = true) => {
    try {
      const config = await invoke<Config | null>("load_config");
      setConfig(config);
      if (!config) return;
      const { logs, fingerprint, ...peers } = await invoke<Loaded>("load_folder", { dir: config.dir, device: config.device, checkIn });
      loaded.current = { dir: config.dir, fingerprint };
      setState(fold(parseLogs(logs)));
      setPeers(peers);
      setError(undefined);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  /** Reads the logs again only if one changed since they were last read. */
  const refresh = useCallback(async () => {
    const last = loaded.current;
    if (!last || document.hidden) return;
    try {
      if ((await invoke<string>("logs_fingerprint", { dir: last.dir })) !== last.fingerprint) await reload(false);
    } catch {
      // A folder that can't be read shows up on the next full reload.
    }
  }, [reload]);

  useEffect(() => {
    reload();
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [reload, refresh]);

  /** Applies to the newest state, so a reload that lands while writing isn't undone. */
  const commit = useCallback(
    async (...changes: Change[]) => {
      if (!config) return;
      const events = changes.map((change) => stamp(change, config.device));
      await invoke("append_events", {
        dir: config.dir,
        device: config.device,
        lines: events.map((event) => JSON.stringify(event)),
      });
      setState((state) => {
        if (!state) return state;
        const next = structuredClone(state);
        events.forEach((event) => apply(next, event));
        return next;
      });
    },
    [config],
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
