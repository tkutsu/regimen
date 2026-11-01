import { useState } from "react";
import { useRegimen } from "./store";
import { Foods } from "./ui/Foods";
import { Settings } from "./ui/Settings";
import { Setup } from "./ui/Sync";
import { Today } from "./ui/Today";
import { Weight } from "./ui/Weight";

const SCREENS = { today: Today, weight: Weight, foods: Foods };
type Tab = keyof typeof SCREENS | "settings";
const TABS: Tab[] = ["today", "weight", "foods", "settings"];

export default function App() {
  const { config, state, peers, error, reload, commit, saveConfig } = useRegimen();
  const [tab, setTab] = useState<Tab>("today");

  if (config === null) return <Setup onSave={saveConfig} />;
  if (error) return config ? <Setup saved={config} error={error} onSave={saveConfig} onRetry={reload} /> : <p className="p-4 text-bad">{error}</p>;
  if (!config || !state || !peers) return null;
  const Screen = tab === "settings" ? undefined : SCREENS[tab];
  return (
    <div className="mx-auto max-w-md p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <nav className="mb-4 flex gap-4 text-sm">
        {TABS.map((name) => (
          <button key={name} onClick={() => setTab(name)} className={`capitalize ${tab === name ? "font-medium" : "text-muted"}`}>
            {name}
          </button>
        ))}
      </nav>
      {Screen ? <Screen state={state} commit={commit} /> : <Settings state={state} commit={commit} config={config} peers={peers} onSaveConfig={saveConfig} />}
    </div>
  );
}
