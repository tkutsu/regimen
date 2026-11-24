import type { SettingsPatch, Theme } from "../domain/types";
import type { Config, Peers } from "../store";
import { Section } from "./fields";
import { Devices, SyncForm } from "./Sync";

type Set = (patch: SettingsPatch) => Promise<boolean>;

/** This device's sync folder and name, and the devices seen in it. */
export function SyncDevices({ config, peers, onSaveConfig }: { config: Config; peers: Peers; onSaveConfig: (config: Config) => Promise<void> }) {
  return (
    <>
      <Devices config={config} peers={peers} />
      <section>
        <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">Sync</h2>
        <SyncForm key={`${config.dir}|${config.device}`} saved={config} initial={config} action="Save" onSave={onSaveConfig} />
      </section>
    </>
  );
}

const THEMES: Theme[] = ["system", "light", "dark"];

export function Appearance({ theme, set }: { theme: Theme; set: Set }) {
  return (
    <Section title="Look">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="flex-1">Theme</span>
        <div className="flex gap-1 rounded-xl bg-line/50 p-1 text-sm">
          {THEMES.map((name) => (
            <button
              key={name}
              onClick={() => set({ theme: name })}
              aria-pressed={theme === name}
              className={`min-h-9 rounded-lg px-3 capitalize ${theme === name ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
