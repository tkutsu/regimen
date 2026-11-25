import { useCallback, useState } from "react";
import { localDate } from "./domain/day";
import type { Change } from "./domain/types";
import { useRegimen } from "./store";
import { OpenSettings } from "./ui/Header";
import { useKeys } from "./ui/keys";
import { Library } from "./ui/Library";
import { useLook, useRemembered } from "./ui/look";
import { transition } from "./ui/motion";
import { Progress } from "./ui/Progress";
import { Settings } from "./ui/Settings";
import { Setup } from "./ui/Sync";
import { Today } from "./ui/Today";
import { Training } from "./ui/Training";
import { OfferUndo, UndoToast, type Undoable } from "./ui/undo";

const TABS = ["today", "training", "progress", "library"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS = {
  today: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 5 3 3 5-5" /></>,
  training: <path d="M7 12h10M3 9v6m4-9v12m10-12v12m4-9v6M3 12h4m10 0h4" />,
  progress: <path d="M3 3v18h18M7 15l4-4 3 3 6-6" />,
  library: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="9.5" y="4" width="5" height="16" rx="1" /><path d="m16 5.5 3.4-1 2.8 14.6-3.4 1z" /></>,
};

export default function App() {
  const { config, state, peers, error, saveError, reload, commit, retrySave, dismissSaveError, saveConfig } = useRegimen();
  const [tab, setTab] = useRemembered<Tab>("last-tab", "today", TABS);
  // Settings opens over whichever tab you were on; any tab, or Done, leaves it.
  const [settings, setSettings] = useState(false);
  // Today and Training show the same day, so switching tabs keeps it.
  const [date, setDate] = useState(localDate);
  const [undo, setUndo] = useState<Undoable>();
  const go = useCallback((next: Tab) => transition(() => { setSettings(false); setTab(next); }), [setTab]);
  const openSettings = useCallback(() => transition(() => setSettings(true)), []);
  const pickDate = useCallback((next: string) => transition(() => setDate(next)), []);
  const offerUndo = useCallback((message: string, ...changes: Change[]) => setUndo({ message, changes, at: Date.now() }), []);
  const dismissUndo = useCallback(() => setUndo(undefined), []);
  useLook(state?.settings);
  useKeys(TABS, tab, go);

  if (config === null) return <Setup onSave={saveConfig} />;
  if (error) return config ? <Setup saved={config} error={error} onSave={saveConfig} onRetry={() => reload()} /> : <p className="p-4 text-bad">{error}</p>;
  if (!config || !state || !peers) return null;
  const screen = settings ? (
    <Settings state={state} commit={commit} config={config} peers={peers} onSaveConfig={saveConfig} onDone={() => transition(() => setSettings(false))} />
  ) : tab === "today" ? (
    <Today state={state} commit={commit} date={date} onDate={pickDate} />
  ) : tab === "training" ? (
    <Training state={state} commit={commit} date={date} onDate={pickDate} />
  ) : tab === "progress" ? (
    <Progress state={state} commit={commit} />
  ) : (
    <Library state={state} commit={commit} />
  );
  return (
    <div data-app className="mx-auto min-h-dvh max-w-md px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[calc(var(--tabs)+2rem)]">
      <main>
        <OpenSettings.Provider value={settings ? undefined : openSettings}>
          <OfferUndo.Provider value={offerUndo}>{screen}</OfferUndo.Provider>
        </OpenSettings.Provider>
      </main>
      {/* At the bottom, in reach of a thumb. Each tab takes an equal share of the row. */}
      <nav aria-label="Screens" data-tabs className="fixed inset-x-0 bottom-0 z-[2] border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-14 max-w-md px-2">
          {TABS.map((name) => {
            const current = !settings && tab === name;
            return (
              <button
                key={name}
                data-tab={name}
                onClick={() => go(name)}
                aria-current={current ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs capitalize transition-colors ${current ? "font-medium text-accent" : "text-muted"}`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {TAB_ICONS[name]}
                </svg>
                {name}
              </button>
            );
          })}
        </div>
      </nav>
      {undo && (
        <UndoToast
          undo={undo}
          onUndo={async () => {
            if (await commit(...undo.changes)) setUndo(undefined);
          }}
          onDismiss={dismissUndo}
        />
      )}
      {saveError && <SaveFailed message={saveError.message} onRetry={retrySave} onDismiss={dismissSaveError} />}
    </div>
  );
}

/** Above any open editor, which stays open with what was typed. */
function SaveFailed({ message, onRetry, onDismiss }: { message: string; onRetry: () => void; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-20 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-bad/40 bg-surface px-4 py-2.5 text-sm shadow-lg"
    >
      <span className="min-w-0 flex-1 text-bad">Couldn't save: {message}</span>
      <button onClick={onRetry} className="shrink-0 font-medium text-accent">
        Try again
      </button>
      <button onClick={onDismiss} aria-label="Dismiss" className="-mr-1 w-6 shrink-0 text-lg leading-none text-muted">
        ×
      </button>
    </div>
  );
}
