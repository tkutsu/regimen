import { useCallback, useState } from "react";
import { useRegimen } from "./store";
import { Foods } from "./ui/Foods";
import { useKeys } from "./ui/keys";
import { useLook } from "./ui/look";
import { transition } from "./ui/motion";
import { Settings } from "./ui/Settings";
import { Setup } from "./ui/Sync";
import { System } from "./ui/System";
import { Today } from "./ui/Today";
import { Training } from "./ui/Training";
import { Weight } from "./ui/Weight";

const SCREENS = { today: Today, training: Training, weight: Weight, foods: Foods, settings: Settings };
type Tab = keyof typeof SCREENS | "system";
const TABS: Tab[] = ["today", "training", "weight", "foods", "settings", "system"];

export default function App() {
  const { config, state, peers, error, saveError, reload, commit, retrySave, dismissSaveError, saveConfig } = useRegimen();
  const [tab, setTab] = useState<Tab>("today");
  const go = useCallback((next: Tab) => transition(() => setTab(next)), []);
  useLook(state?.settings);
  useKeys(TABS, tab, go);

  if (config === null) return <Setup onSave={saveConfig} />;
  if (error) return config ? <Setup saved={config} error={error} onSave={saveConfig} onRetry={() => reload()} /> : <p className="p-4 text-bad">{error}</p>;
  if (!config || !state || !peers) return null;
  const Screen = tab === "system" ? undefined : SCREENS[tab];
  return (
    <div data-app className="mx-auto min-h-dvh max-w-md p-4 pt-0 pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Each tab grows into the space beside it, so a tap anywhere on the row lands on one. The
          end tabs take half a share and sit flush, keeping the labels evenly spaced. */}
      <nav aria-label="Screens" className="sticky top-0 z-[2] -mx-4 mb-4 flex bg-bg px-4 pt-[max(0.5rem,env(safe-area-inset-top))] text-sm">
        {TABS.map((name) => (
          <button
            key={name}
            data-tab={name}
            onClick={() => go(name)}
            aria-current={tab === name ? "page" : undefined}
            className={`grow py-2 capitalize transition-colors first:grow-[0.5] first:text-left last:grow-[0.5] last:text-right ${tab === name ? "font-medium" : "text-muted"}`}
          >
            {name}
          </button>
        ))}
      </nav>
      <main>
        {Screen ? <Screen state={state} commit={commit} /> : <System state={state} commit={commit} config={config} peers={peers} onSaveConfig={saveConfig} />}
      </main>
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
