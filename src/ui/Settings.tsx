import { useMemo, useState } from "react";
import { LIMIT_UNITS, localDate } from "../domain/day";
import { allFoods, LABELS, pickableFoods } from "../domain/nutrition";
import { recentFoodIds } from "../domain/search";
import { newId, type State } from "../domain/state";
import type { Change, Container, Limited, Phase, Range, Settings as SettingsT, SettingsPatch, Staple, Theme } from "../domain/types";
import type { Commit, Config, Peers } from "../store";
import { NumberInput, OptionalNumberInput, Remove, Section, TextInput } from "./fields";
import { FoodPicker } from "./FoodPicker";
import { applyLook } from "./look";
import { useReorder } from "./reorder";
import { Devices, SyncForm } from "./Sync";

type Props = {
  state: State;
  commit: Commit;
  config: Config;
  peers: Peers;
  onSaveConfig: (config: Config) => Promise<void>;
};

/** Writes only what changed, so another device's edit to the rest stays. */
type Set = (patch: SettingsPatch) => Promise<boolean>;

export function Settings({ state, commit, config, peers, onSaveConfig }: Props) {
  const settings = state.settings;
  const set: Set = (patch) => commit({ type: "settings", settings: patch });
  const setOffset = (phase: Phase, offset: number) => set({ phaseOffsets: { ...settings.phaseOffsets, [phase]: offset } });

  return (
    <div className="flex flex-col gap-6">
      <Section title="Targets">
        <Row label="Maintenance" unit="kcal">
          <NumberInput value={settings.tdee} onCommit={(tdee) => set({ tdee })} className="w-20 text-right" />
        </Row>
        {(["cut", "maintain", "bulk"] as Phase[]).map((phase) => (
          <Row key={phase} label={phase} unit="kcal" hint={`= ${settings.tdee + settings.phaseOffsets[phase]}`}>
            <NumberInput value={settings.phaseOffsets[phase]} onCommit={(offset) => setOffset(phase, offset)} className="w-20 text-right" />
          </Row>
        ))}
        <Row label="Steps" unit="kcal/1k">
          <NumberInput value={settings.kcalPer1kSteps} onCommit={(kcalPer1kSteps) => set({ kcalPer1kSteps })} className="w-20 text-right" />
        </Row>
      </Section>

      <Limits limits={settings.limits} set={set} />
      <Staples state={state} commit={commit} />
      <Containers containers={settings.containers} set={set} />
      <Look theme={settings.theme} accentHue={settings.accentHue} set={set} />

      <Devices config={config} peers={peers} />

      <section>
        <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">Sync</h2>
        <SyncForm key={`${config.dir}|${config.device}`} saved={config} initial={config} action="Save" onSave={onSaveConfig} />
      </section>
    </div>
  );
}

const LIMITED: Limited[] = ["prot", "fiber", "satFat", "unsatFat", "salt", "sugar"];

/** A lower and an upper bound per nutrient; either can be blank. */
function Limits({ limits, set }: { limits: SettingsT["limits"]; set: Set }) {
  const setRange = (key: Limited, patch: Range) => set({ limits: { [key]: { ...limits[key], ...patch } } });
  return (
    <Section
      title="Limits"
      aside={
        <span className="flex pr-3 text-xs text-muted normal-case">
          <span className="w-16 text-right">min</span>
          <span className="w-16 text-right">max</span>
          <span className="w-20" />
        </span>
      }
    >
      {LIMITED.map((key) => (
        <label key={key} className="flex items-center px-4 py-2.5">
          <span className="flex-1 first-letter:uppercase">{LABELS[key]}</span>
          <OptionalNumberInput value={limits[key].min} onCommit={(min) => setRange(key, { min })} aria-label={`${LABELS[key]} min`} placeholder="–" className="w-16 text-right placeholder:text-muted/50" />
          <OptionalNumberInput value={limits[key].max} onCommit={(max) => setRange(key, { max })} aria-label={`${LABELS[key]} max`} placeholder="–" className="w-16 text-right placeholder:text-muted/50" />
          <span className="w-20 pl-2 text-xs text-muted">{LIMIT_UNITS[key]}</span>
        </label>
      ))}
    </Section>
  );
}

/** Foods planned on every day from now on. Removing one from a day on Today leaves the others alone. */
function Staples({ state, commit }: { state: State; commit: Commit }) {
  const [picking, setPicking] = useState(false);
  const foods = useMemo(() => allFoods(state), [state]);
  const pickable = useMemo(() => pickableFoods(state), [state]);
  const { staples, containers } = state.settings;
  const save = (next: Staple[], ...also: Change[]) => commit(...also, { type: "settings", settings: { staples: next } });

  return (
    <Section title="Staples" aside={<span className="text-xs text-muted normal-case">planned every day</span>}>
      {staples.map((staple) => {
        const food = foods.get(staple.foodId);
        return (
          <div key={staple.id} className="flex items-center gap-2 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate">
              {food?.name ?? "unknown food"}
              {staple.variant && <span className="text-muted"> · {staple.variant}</span>}
            </span>
            <NumberInput
              value={staple.amount}
              onCommit={(amount) => amount > 0 && save(staples.map((s) => (s.id === staple.id ? { ...s, amount } : s)))}
              className="w-16 text-right"
            />
            <span className="w-4 text-sm text-muted">{food?.basis === "item" ? "×" : "g"}</span>
            <Remove label={food?.name ?? "staple"} onClick={() => save(staples.filter((s) => s.id !== staple.id))} />
          </div>
        );
      })}
      <button onClick={() => setPicking(true)} className="w-full px-4 py-2.5 text-left text-accent">
        Add staple
      </button>
      {picking && (
        <FoodPicker
          foods={pickable}
          recentIds={recentFoodIds(state)}
          containers={containers}
          addLabel="Add staple"
          onAdd={async (food, amount, _, variant) => {
            const staple = { id: newId(), foodId: food.id, amount, variant: variant?.name, factor: variant?.factor, from: localDate() };
            // A reference-table food becomes one of yours, as on Today.
            if (await save([...staples, staple], ...(foods.has(food.id) ? [] : [{ type: "food.upsert", food } as Change]))) setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </Section>
  );
}

function Containers({ containers, set }: { containers: Container[]; set: Set }) {
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const weight = Number(grams.replace(",", "."));
  const valid = name.trim() !== "" && weight > 0;
  const edit = (id: string, patch: Partial<Container>) => set({ containers: containers.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const { shown, dragging, handle } = useReorder(containers, (c) => c.id, (next) => set({ containers: next }));

  const add = async () => {
    if (!valid || !(await set({ containers: [...containers, { id: newId(), name: name.trim(), grams: weight }] }))) return;
    setName("");
    setGrams("");
  };

  return (
    <Section title="Containers">
      {shown.map((c) => (
        <div key={c.id} data-row={c.id} className={`flex items-center gap-2 py-2 pr-4 pl-2 ${dragging === c.id ? "bg-line/40" : ""}`}>
          <button {...handle(c, c.name)} />
          <TextInput value={c.name} onCommit={(name) => edit(c.id, { name })} className="min-w-0 flex-1" />
          <NumberInput value={c.grams} onCommit={(grams) => grams > 0 && edit(c.id, { grams })} className="w-16 text-right" />
          <span className="w-4 text-sm text-muted">g</span>
          <Remove label={c.name} onClick={() => set({ containers: containers.filter((other) => other.id !== c.id) })} />
        </div>
      ))}
      <div className="flex items-center gap-2 px-4 py-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" aria-label="New container name" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/60" />
        <input
          value={grams}
          inputMode="decimal"
          onChange={(e) => setGrams(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="grams"
          aria-label="New container grams"
          className="w-16 bg-transparent text-right outline-none placeholder:text-muted/60"
        />
        <button disabled={!valid} onClick={add} className="w-10 text-right text-accent disabled:opacity-40">
          Add
        </button>
      </div>
    </Section>
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

function Row({ label, unit, hint, children }: { label: string; unit: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 px-4 py-2.5">
      <span className="flex-1 capitalize">{label}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
      {children}
      <span className="w-14 text-sm text-muted">{unit}</span>
    </label>
  );
}
