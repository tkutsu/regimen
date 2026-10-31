import { useState } from "react";
import { useRegimen } from "./store";
import { Settings } from "./ui/Settings";
import { Today } from "./ui/Today";

const TABS = { today: Today, settings: Settings };

export default function App() {
  const { state, error, commit } = useRegimen();
  const [tab, setTab] = useState<keyof typeof TABS>("today");

  if (error) return <p className="p-4 text-bad">{error}</p>;
  if (!state) return null;
  const Screen = TABS[tab];
  return (
    <div className="mx-auto max-w-md p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <nav className="mb-4 flex gap-4 text-sm">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((name) => (
          <button key={name} onClick={() => setTab(name)} className={`capitalize ${tab === name ? "font-medium" : "text-muted"}`}>
            {name}
          </button>
        ))}
      </nav>
      <Screen state={state} commit={commit} />
    </div>
  );
}
