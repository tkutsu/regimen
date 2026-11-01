import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyEvents, fold, parseLogs, stamp, type State } from "./domain/state";
import type { Change, Event } from "./domain/types";
import { transition } from "./ui/motion";

/** Where this device keeps the logs and the name of its own log. */
export type Config = { dir: string; device: string };

/** A device's check-in: where it keeps the folder and when it last opened the app (Unix seconds). */
export type Device = { name: string; platform: "desktop" | "mobile"; dir: string; seen: number };

/** Who syncs this folder, and whether Syncthing shares it here (null when unknown, on Android). */
export type Peers = { devices: Device[]; synced: boolean | null };

/** Writes changes to this device's log; false when the write failed, so an editor can stay open. */
export type Commit = (...changes: Change[]) => Promise<boolean>;

/** A write that failed, kept to try again. */
export type SaveError = { message: string; changes: Change[] };

type Loaded = Peers & { logs: string[]; fingerprint: string };

/** How often a visible app checks whether another device's log or check-in changed. */
const POLL_MS = 20_000;

/**
 * Loads the merged state from the sync folder and keeps it current. Opening the app (or
 * coming back to it) reads everything and checks this device in. Focusing the window, and
 * every 20 s while it's visible, only compares the folder's fingerprint (names, sizes,
 * change times) and reads it again when something changed.
 * `config` is null on first run, before a folder is chosen.
 */
export function useRegimen() {
  const [config, setConfig] = useState<Config | null>();
  const [state, setState] = useState<State>();
  const [peers, setPeers] = useState<Peers>();
  const [error, setError] = useState<string>();
  const [saveError, setSaveError] = useState<SaveError>();
  const loaded = useRef<{ dir: string; fingerprint: string }>(undefined);
  /** Counts reloads, so only the latest one started shows what it read. */
  const generation = useRef(0);
  /**
   * Events written since the latest reload began. Its read may have missed them, so
   * they're merged into what it read; ids keep them from counting twice.
   */
  const written = useRef<Event[]>([]);

  const reload = useCallback(async (checkIn = true) => {
    const run = ++generation.current;
    const before = written.current.length;
    try {
      const config = await invoke<Config | null>("load_config");
      if (run !== generation.current) return;
      setConfig(config);
      if (!config) return;
      const { logs, fingerprint, ...peers } = await invoke<Loaded>("load_folder", { dir: config.dir, device: config.device, checkIn });
      if (run !== generation.current) return;
      // Written before this read began, so they're in the logs already.
      written.current = written.current.slice(before);
      loaded.current = { dir: config.dir, fingerprint };
      setState(fold(parseLogs(logs, written.current)));
      setPeers(peers);
      setError(undefined);
    } catch (e) {
      if (run === generation.current) setError(String(e));
    }
  }, []);

  /** Reads the folder again only if something in it changed since it was last read. */
  const refresh = useCallback(async () => {
    const last = loaded.current;
    if (!last || document.hidden) return;
    try {
      if ((await invoke<string>("folder_fingerprint", { dir: last.dir })) !== last.fingerprint) await reload(false);
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

  /**
   * Applies to the newest state, so a reload that lands while writing isn't undone. The
   * change animates in, and the promise resolves once it's on screen.
   */
  const commit: Commit = useCallback(
    async (...changes) => {
      if (!config) return false;
      const events = changes.map((change) => stamp(change, config.device));
      try {
        await invoke("append_events", { dir: config.dir, device: config.device, lines: events.map((event) => JSON.stringify(event)) });
      } catch (e) {
        setSaveError({ message: String(e), changes });
        return false;
      }
      written.current.push(...events);
      await transition(() => setState((state) => state && applyEvents(state, events)));
      return true;
    },
    [config],
  );

  const retrySave = useCallback(async () => {
    if (!saveError) return;
    setSaveError(undefined);
    await commit(...saveError.changes);
  }, [commit, saveError]);

  /**
   * Switching folders reads everything again from the new one. A new name takes this
   * device's log with it, in the folder it has been writing to.
   */
  const saveConfig = useCallback(
    async (next: Config) => {
      if (config && config.device !== next.device) await invoke("rename_device", { dir: config.dir, from: config.device, to: next.device });
      await invoke("save_config", { config: next });
      written.current = [];
      setState(undefined);
      await reload();
    },
    [config, reload],
  );

  return { config, state, peers, error, saveError, reload, commit, retrySave, dismissSaveError: () => setSaveError(undefined), saveConfig };
}
