import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Config, Device, Peers } from "../store";

type Folder = { exists: boolean; logs: string[]; synced: boolean | null };

/** Android picks the folder with the system picker; desktop types a path. */
const ANDROID = /Android/.test(navigator.userAgent);
const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** Another device counts as syncing while its check-ins keep arriving. */
const FRESH = 2 * 24 * 3600;
/** Seen this recently, it's syncing right now. */
const LIVE = 15 * 60;

/** A readable folder: `content://…/tree/primary%3A_Files%2Fregimen` reads as `_Files/regimen`. */
export function folderLabel(dir: string) {
  const tree = dir.match(/\/tree\/([^/]+)/);
  if (tree) return decodeURIComponent(tree[1]).replace(/^primary:/, "");
  return dir.replace(/^\/home\/[^/]+/, "~");
}

function ago(seconds: number) {
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 48 * 3600) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

/**
 * Every device that syncs this folder, from their check-ins, by platform. The dot is
 * green while a device's check-ins keep arriving, and pulses when it was just seen.
 * This device's dot says whether anything arrives here from the others.
 */
export function Devices({ config, peers }: { config: Config; peers: Peers }) {
  const now = Date.now() / 1000;
  const others = peers.devices.filter((device) => device.name !== config.device);
  const hearing = others.some((device) => now - device.seen < FRESH);
  const problem =
    peers.synced === false
      ? "Syncthing doesn't share this folder, so nothing syncs. Pick the folder Syncthing syncs below."
      : !others.length
        ? "No other device has synced into this folder yet."
        : !hearing
          ? "Nothing from the other devices in 2 days. Is Syncthing running on each?"
          : undefined;

  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">Devices</h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {(["desktop", "mobile"] as const).map((platform) => {
          const devices = peers.devices.filter((device) => device.platform === platform).sort((a, b) => a.name.localeCompare(b.name));
          if (!devices.length) return null;
          return (
            <div key={platform} className="border-line not-first:border-t">
              <h3 className="px-4 pt-2.5 text-xs text-muted capitalize">{platform}</h3>
              {devices.map((device) => {
                const self = device.name === config.device;
                const age = now - device.seen;
                return (
                  <DeviceRow
                    key={device.name}
                    device={device}
                    self={self}
                    syncing={self ? hearing && peers.synced !== false : age < FRESH}
                    live={!self && age < LIVE}
                    note={self ? "This device" : ago(age)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      {problem && <p className="mt-2 px-1 text-xs text-bad">{problem}</p>}
    </section>
  );
}

function DeviceRow({ device, self, syncing, live, note }: { device: Device; self: boolean; syncing: boolean; live: boolean; note: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="relative mt-2 flex size-2 shrink-0" title={syncing ? "Syncing" : "Not syncing"}>
        {live && <span className="absolute inset-0 animate-ping rounded-full bg-good opacity-60" />}
        <span className={`relative size-2 rounded-full ${syncing ? "bg-good" : "bg-muted/50"}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={self ? "font-medium" : ""}>{device.name}</span>
          <span className={`ml-auto shrink-0 text-xs ${self ? "rounded-full bg-accent/15 px-2 py-0.5 text-accent" : "text-muted"}`}>{note}</span>
        </span>
        <span className="block truncate text-xs text-muted">{folderLabel(device.dir)}</span>
      </span>
    </div>
  );
}

type Props = {
  /** The config in use, if any; its own name isn't a clash. */
  saved?: Config;
  initial: Config;
  action: string;
  onSave: (config: Config) => Promise<void>;
};

/**
 * The folder and this device's name. Shows what the folder already holds, so a
 * wrong folder or a name another device writes under is caught before saving.
 */
export function SyncForm({ saved, initial, action, onSave }: Props) {
  const [dir, setDir] = useState(initial.dir);
  const [device, setDevice] = useState(initial.device);
  const [folder, setFolder] = useState<Folder | string>();
  const [failed, setFailed] = useState<string>();

  const path = dir.trim();
  const name = device.trim();
  const chosen = ANDROID ? path.startsWith("content://") : ABSOLUTE.test(path);

  useEffect(() => {
    setFolder(undefined);
    if (!chosen) return;
    let live = true;
    const timer = setTimeout(() => {
      invoke<Folder>("inspect_dir", { dir: path }).then(
        (found) => live && setFolder(found),
        (e) => live && setFolder(String(e)),
      );
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [path, chosen]);

  const own = saved?.dir === path && saved.device === name;
  const nameProblem = !NAME.test(name)
    ? "Letters, digits, - and _ only."
    : name === "import"
      ? "“import” is kept for imported data."
      : undefined;
  // Keeping your own name in another folder is still you.
  const clash = typeof folder === "object" && folder.logs.includes(name) && saved?.device !== name;
  const renamed = saved && saved.device !== name;
  const valid = chosen && !nameProblem;

  const pick = async () => {
    try {
      setFailed(undefined);
      const picked = await invoke<string | null>("pick_dir");
      if (picked) setDir(picked);
    } catch (e) {
      setFailed(String(e));
    }
  };

  const save = async () => {
    try {
      setFailed(undefined);
      await onSave({ dir: path, device: name });
    } catch (e) {
      setFailed(String(e));
    }
  };

  const folderNotes = !chosen ? (
    <Note>{ANDROID ? "Pick the folder Syncthing syncs." : "Use a full path."}</Note>
  ) : typeof folder === "string" ? (
    <Note bad>Can't read this folder: {folder}</Note>
  ) : folder ? (
    <>
      {!folder.exists ? (
        <Note>Doesn't exist yet. It's created when you start.</Note>
      ) : !folder.logs.length ? (
        <Note>No logs here yet, so you start fresh.</Note>
      ) : (
        <Note>Logs here from {folder.logs.join(", ")}.</Note>
      )}
      {folder.synced === false && <Note bad>Syncthing doesn't share this folder, so other devices won't see it.</Note>}
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      {ANDROID ? (
        <div className="flex flex-col gap-1">
          <button onClick={pick} className="rounded-xl border border-line bg-surface px-3 py-2 text-left">
            <span className="block text-xs text-muted">Folder</span>
            <span className={chosen ? "" : "text-accent"}>{chosen ? folderLabel(path) : "Choose a folder…"}</span>
          </button>
          {folderNotes}
        </div>
      ) : (
        <Field label="Folder" value={dir} onChange={setDir}>
          {folderNotes}
        </Field>
      )}
      <Field label="This device" value={device} onChange={setDevice}>
        {nameProblem ? (
          <Note bad>{nameProblem}</Note>
        ) : clash ? (
          <Note bad>
            Another device already writes as “{name}”. Keep it only if this is that device{renamed && `: “${saved.device}” merges into it`}.
          </Note>
        ) : renamed ? (
          <Note>Saving renames this device's log from “{saved.device}” to “{name}”.</Note>
        ) : (
          <Note>Each device writes its own log, so give each a different name.</Note>
        )}
      </Field>
      {failed && <Note bad>{failed}</Note>}
      <button
        disabled={!valid || (saved && own)}
        onClick={save}
        className="rounded-xl bg-accent py-2.5 font-medium text-bg disabled:opacity-40"
      >
        {action}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-accent">
        <span className="block text-xs text-muted">{label}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full bg-transparent outline-none"
        />
      </span>
      {children}
    </label>
  );
}

function Note({ bad, children }: { bad?: boolean; children: React.ReactNode }) {
  return <span className={`px-1 text-xs ${bad ? "text-bad" : "text-muted"}`}>{children}</span>;
}

/** First run, or a folder that can't be read: nothing else works until a folder does. */
export function Setup({ saved, error, onSave, onRetry }: { saved?: Config; error?: string; onSave: Props["onSave"]; onRetry?: () => void }) {
  const [suggested, setSuggested] = useState<Config | undefined>(saved);
  useEffect(() => {
    if (!saved) invoke<Config>("suggest_config").then(setSuggested);
  }, [saved]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pt-[max(2rem,env(safe-area-inset-top))]">
      <h1 className="text-2xl font-semibold">Regimen</h1>
      {error ? (
        <p className="text-sm text-bad">
          Couldn't read {saved && folderLabel(saved.dir)}: {error}
        </p>
      ) : (
        <p className="text-sm text-muted">
          Your foods, days and weigh-ins are kept as plain files in a folder. To use more than one device, pick a folder Syncthing keeps in sync on each.
        </p>
      )}
      {suggested && <SyncForm saved={saved} initial={suggested} action={saved ? "Save" : "Start"} onSave={onSave} />}
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-accent">
          Try again
        </button>
      )}
    </div>
  );
}
