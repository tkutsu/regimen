import { useState } from "react";
import type { State } from "../domain/state";
import type { SettingsPatch, Theme } from "../domain/types";
import type { Commit, Config, Peers } from "../store";
import { Section } from "./fields";
import { applyLook } from "./look";
import { Devices, SyncForm } from "./Sync";

type Props = {
  state: State;
  commit: Commit;
  config: Config;
  peers: Peers;
  onSaveConfig: (config: Config) => Promise<void>;
};

type Set = (patch: SettingsPatch) => Promise<boolean>;

/** How the app looks and where it syncs, apart from the targets and foods in Settings. */
export function System({ state, commit, config, peers, onSaveConfig }: Props) {
  const set: Set = (patch) => commit({ type: "settings", settings: patch });
  return (
    <div className="flex flex-col gap-6">
      <Look theme={state.settings.theme} accentHue={state.settings.accentHue} set={set} />

      <Devices config={config} peers={peers} />

      <section>
        <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">Sync</h2>
        <SyncForm key={`${config.dir}|${config.device}`} saved={config} initial={config} action="Save" onSave={onSaveConfig} />
      </section>
    </div>
  );
}

const THEMES: Theme[] = ["system", "light", "dark"];

/** The hue slider previews while dragging and saves on release, so a drag is one event. */
function Look({ theme, accentHue, set }: { theme: Theme; accentHue: number; set: Set }) {
  const [hue, setHue] = useState<number>();
  const preview = (next: number) => {
    setHue(next);
    applyLook({ theme, accentHue: next });
  };
  const save = () => {
    if (hue !== undefined && hue !== accentHue) set({ accentHue: hue });
    setHue(undefined);
  };
  return (
    <Section title="Look">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="flex-1">Theme</span>
        <div className="flex gap-1 rounded-xl bg-line/50 p-1 text-sm">
          {THEMES.map((name) => (
            <button
              key={name}
              onClick={() => set({ theme: name })}
              className={`rounded-lg px-3 py-1 capitalize ${theme === name ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-4 px-4 py-3">
        <span>Accent</span>
        <input
          type="range"
          min={0}
          max={359}
          value={hue ?? accentHue}
          onChange={(e) => preview(Number(e.target.value))}
          onPointerUp={save}
          onKeyUp={save}
          onBlur={save}
          className="hue min-w-0 flex-1"
        />
      </label>
    </Section>
  );
}
