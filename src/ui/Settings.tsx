import { useMemo, useState } from "react";
import { LIMIT_UNITS, localDate } from "../domain/day";
import { allFoods, LABELS, LIMITED, pickableFoods, toggleFav, usedName } from "../domain/nutrition";
import { recentFoodIds } from "../domain/search";
import { newId, type State } from "../domain/state";
import type { Change, Container, Limited, Phase, Range, Settings as SettingsT, SettingsPatch, Staple } from "../domain/types";
import type { Commit, Config, Peers } from "../store";
import { useBack } from "./Dialog";
import { NumberInput, OptionalNumberInput, Remove, Section, TextInput } from "./fields";
import { FoodPicker } from "./FoodPicker";
import { Header } from "./Header";
import { transition } from "./motion";
import { useReorder } from "./reorder";
import { Appearance, SyncDevices } from "./System";

type Props = { state: State; commit: Commit; config: Config; peers: Peers; onSaveConfig: (config: Config) => Promise<void>; onDone: () => void };

/** Writes only what changed, so another device's edit to the rest stays. */
type Set = (patch: SettingsPatch) => Promise<boolean>;

const PAGES = { targets: "Targets", limits: "Limits", staples: "Staples", containers: "Containers", look: "Appearance", sync: "Sync & devices" };
type Page = keyof typeof PAGES;

/** A list of pages, each opening on its own; Back steps out of a page, then out of Settings. */
export function Settings({ state, commit, config, peers, onSaveConfig, onDone }: Props) {
  const [page, setPage] = useState<Page>();
  useBack(onDone);
  const settings = state.settings;
  const set: Set = (patch) => commit({ type: "settings", settings: patch });
  const open = (next?: Page) =>
    transition(() => {
      setPage(next);
      window.scrollTo(0, 0);
    });
  const done = (
    <button onClick={onDone} className="-mr-2 min-h-11 px-2 font-medium text-accent">
      Done
    </button>
  );

  if (page)
    return (
      <Subpage title={PAGES[page]} done={done} onBack={() => open()}>
        {page === "targets" && <Targets settings={settings} set={set} />}
        {page === "limits" && <Limits limits={settings.limits} set={set} />}
        {page === "staples" && <Staples state={state} commit={commit} />}
        {page === "containers" && <Containers containers={settings.containers} set={set} />}
        {page === "look" && <Appearance theme={settings.theme} set={set} />}
        {page === "sync" && <SyncDevices config={config} peers={peers} onSaveConfig={onSaveConfig} />}
      </Subpage>
    );

  const bounds = LIMITED.filter((key) => settings.limits[key].min !== undefined || settings.limits[key].max !== undefined).length;
  const row = (name: Page, summary: string) => <PageRow key={name} label={PAGES[name]} summary={summary} onOpen={() => open(name)} />;
  return (
    <div className="flex flex-col gap-6">
      <Header title="Settings">{done}</Header>
      <Section title="Food">
        {row("targets", `${settings.tdee} kcal maintenance`)}
        {row("limits", `${bounds} ${bounds === 1 ? "nutrient" : "nutrients"}`)}
        {row("staples", `${settings.staples.length} planned daily`)}
        {row("containers", `${settings.containers.length}`)}
      </Section>
      <Section title="App">
        {row("look", settings.theme[0].toUpperCase() + settings.theme.slice(1))}
        {row("sync", config.device)}
      </Section>
    </div>
  );
}

function PageRow({ label, summary, onOpen }: { label: string; summary: string; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left">
      <span className="flex-1">{label}</span>
      <span className="min-w-0 truncate text-sm text-muted">{summary}</span>
      <span aria-hidden className="text-xl leading-none text-muted">›</span>
    </button>
  );
}

function Subpage({ title, done, onBack, children }: { title: string; done: React.ReactNode; onBack: () => void; children: React.ReactNode }) {
  useBack(onBack);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <button onClick={onBack} className="-ml-1 flex min-h-9 items-center gap-1 px-1 text-accent">
          <span aria-hidden className="text-xl leading-none">‹</span> Settings
        </button>
        <Header title={title}>{done}</Header>
      </div>
      {children}
    </div>
  );
}

/** Calories per phase, and what the maintenance reading leaves out. */
function Targets({ settings, set }: { settings: SettingsT; set: Set }) {
  const setOffset = (phase: Phase, offset: number) => set({ phaseOffsets: { ...settings.phaseOffsets, [phase]: offset } });
  return (
    <>
      <Section title="Calories">
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

      <Section title="Real maintenance" aside={<span className="text-xs text-muted normal-case">at the start of each phase</span>}>
        <Row label="Skipped days" unit="days">
          <NumberInput value={settings.settleDays} onCommit={(days) => set({ settleDays: Math.max(0, Math.round(days)) })} className="w-20 text-right" />
        </Row>
      </Section>
    </>
  );
}

/** A lower and an upper bound per nutrient; either can be blank. */
function Limits({ limits, set }: { limits: SettingsT["limits"]; set: Set }) {
  const setRange = (key: Limited, patch: Range) => set({ limits: { [key]: { ...limits[key], ...patch } } });
  return (
    <Section
      title="Per day"
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
          <span className="w-20 text-xs text-muted">{LIMIT_UNITS[key]}</span>
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
    <Section title="Planned every day">
      {staples.map((staple) => {
        const food = foods.get(staple.foodId);
        return (
          <div key={staple.id} className="flex items-center gap-2 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate">
              {usedName(food)}
              {staple.variant && <span className="text-muted"> · {staple.variant}</span>}
            </span>
            <span className="inline-flex items-baseline">
              <NumberInput
                value={staple.amount}
                onCommit={(amount) => amount > 0 && save(staples.map((s) => (s.id === staple.id ? { ...s, amount } : s)))}
                className="w-16 text-right"
              />
              <span className="w-4 text-sm text-muted">{food?.basis === "item" ? "×" : "g"}</span>
            </span>
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
          onToggleFav={(food) => commit(...toggleFav(state, food.id))}
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
    <Section title="Empty weights">
      {shown.map((c) => (
        <div key={c.id} data-row={c.id} className={`flex items-center gap-2 py-2 pr-4 pl-2 ${dragging === c.id ? "relative z-10 bg-surface shadow-lg" : ""}`}>
          <button {...handle(c, c.name)} />
          <TextInput value={c.name} onCommit={(name) => edit(c.id, { name })} className="min-w-0 flex-1" />
          <span className="inline-flex items-baseline">
            <NumberInput value={c.grams} onCommit={(grams) => grams > 0 && edit(c.id, { grams })} className="w-16 text-right" />
            <span className="w-4 text-sm text-muted">g</span>
          </span>
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

function Row({ label, unit, hint, children }: { label: string; unit: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 px-4 py-2.5">
      <span className="flex-1 capitalize">{label}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
      <span className="inline-flex items-baseline">
        {children}
        <span className="w-14 text-sm text-muted">{unit}</span>
      </span>
    </label>
  );
}
