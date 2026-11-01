import { useState } from "react";
import { useRegimen } from "./store";
import { Foods } from "./ui/Foods";
import { useKeys } from "./ui/keys";
import { useLook } from "./ui/look";
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
  useLook(state?.settings);
  useKeys(TABS, tab, setTab);

  if (config === null) return <Setup onSave={saveConfig} />;
  if (error) return config ? <Setup saved={config} error={error} onSave={saveConfig} onRetry={() => reload()} /> : <p className="p-4 text-bad">{error}</p>;
  if (!config || !state || !peers) return null;
  const Screen = tab === "system" ? undefined : SCREENS[tab];
  return (
    <div data-app className="mx-auto max-w-md p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <nav aria-label="Screens" className="mb-4 flex justify-between gap-2 text-sm">
        {TABS.map((name) => (
          <button key={name} data-tab={name} onClick={() => setTab(name)} aria-current={tab === name ? "page" : undefined} className={`capitalize ${tab === name ? "font-medium" : "text-muted"}`}>
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
