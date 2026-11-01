import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Config } from "../store";

type Folder = { exists: boolean; logs: string[] };

const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

type Props = {
  /** The config in use, if any; its own name isn't a clash. */
  saved?: Config;
  initial: Config;
  action: string;
  onSave: (config: Config) => Promise<void>;
};

/**
 * The folder and this device's name. Shows what the folder already holds, so a
 * typo'd path or a name another device writes under is caught before saving.
 */
export function SyncForm({ saved, initial, action, onSave }: Props) {
  const [dir, setDir] = useState(initial.dir);
  const [device, setDevice] = useState(initial.device);
  const [folder, setFolder] = useState<Folder | string>();
  const [failed, setFailed] = useState<string>();

  const path = dir.trim();
  const name = device.trim();
  const absolute = ABSOLUTE.test(path);

  useEffect(() => {
    setFolder(undefined);
    if (!absolute) return;
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
  }, [path, absolute]);

  const own = saved?.dir === path && saved.device === name;
  const nameProblem = !NAME.test(name)
    ? "Letters, digits, - and _ only."
    : name === "import"
      ? "“import” is kept for imported data."
      : undefined;
  const clash = typeof folder === "object" && folder.logs.includes(name) && !own;
  const valid = absolute && !nameProblem;

  const save = async () => {
    try {
      setFailed(undefined);
      await onSave({ dir: path, device: name });
    } catch (e) {
      setFailed(String(e));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label="Folder" value={dir} onChange={setDir}>
        {!absolute ? (
          <Note>Use a full path.</Note>
        ) : typeof folder === "string" ? (
          <Note bad>Can't read this folder: {folder}</Note>
        ) : folder && !folder.exists ? (
          <Note>Doesn't exist yet. It's created with your first entry.</Note>
        ) : folder && !folder.logs.length ? (
          <Note>No logs here yet, so you start fresh.</Note>
        ) : folder ? (
          <Note>Logs here from {folder.logs.join(", ")}.</Note>
        ) : null}
      </Field>
      <Field label="This device" value={device} onChange={setDevice}>
        {nameProblem ? (
          <Note bad>{nameProblem}</Note>
        ) : clash ? (
          <Note bad>Another device already writes as “{name}”. Keep it only if this is that device.</Note>
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
          Couldn't read {saved?.dir}: {error}
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
