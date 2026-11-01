import { useMemo, useState } from "react";
import { LIMIT_UNITS, localDate } from "../domain/day";
import { allFoods, LABELS, pickableFoods } from "../domain/nutrition";
import { recentFoodIds } from "../domain/search";
import { newId, type State } from "../domain/state";
import type { Change, Container, Limited, Phase, Range, Settings as SettingsT, Staple, Theme } from "../domain/types";
import type { Config, Peers } from "../store";
import { NumberInput, OptionalNumberInput } from "./fields";
import { FoodPicker } from "./FoodPicker";
import { applyLook } from "./look";
import { Devices, SyncForm } from "./Sync";

type Props = {
  state: State;
  commit: (...changes: Change[]) => void;
  config: Config;
  peers: Peers;
  onSaveConfig: (config: Config) => Promise<void>;
};

type Set = (patch: Partial<SettingsT>) => void;

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
  const setRange = (key: Limited, patch: Range) => set({ limits: { ...limits, [key]: { ...limits[key], ...patch } } });
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
function Staples({ state, commit }: { state: State; commit: (...changes: Change[]) => void }) {
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
          onAdd={(food, amount, _, variant) => {
            const staple = { id: newId(), foodId: food.id, amount, variant: variant?.name, factor: variant?.factor, from: localDate() };
            // A reference-table food becomes one of yours, as on Today.
            save([...staples, staple], ...(foods.has(food.id) ? [] : [{ type: "food.upsert", food } as Change]));
            setPicking(false);
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
  // While a row is dragged, the order shown; saved once on release.
  const [drag, setDrag] = useState<{ id: string; order: Container[] }>();
  const weight = Number(grams.replace(",", "."));
  const valid = name.trim() !== "" && weight > 0;
  const edit = (id: string, patch: Partial<Container>) => set({ containers: containers.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const shown = drag?.order ?? containers;

  const add = () => {
    if (!valid) return;
    set({ containers: [...containers, { id: newId(), name: name.trim(), grams: weight }] });
    setName("");
    setGrams("");
  };
  const drop = () => {
    if (drag && drag.order.some((c, i) => c.id !== containers[i].id)) set({ containers: drag.order });
    setDrag(undefined);
  };
  const step = (i: number, by: number) => {
    const to = i + by;
    if (to < 0 || to >= containers.length) return;
    const next = [...containers];
    [next[i], next[to]] = [next[to], next[i]];
    set({ containers: next });
  };

  return (
    <Section title="Containers">
      {shown.map((c, i) => (
        <div key={c.id} data-container={c.id} className={`flex items-center gap-2 py-2 pr-4 pl-2 ${drag?.id === c.id ? "bg-line/40" : ""}`}>
          <button
            aria-label={`Move ${c.name}`}
            title="Drag to reorder (Alt+↑/↓)"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ id: c.id, order: containers });
            }}
            onPointerMove={(e) => drag && setDrag({ ...drag, order: dropAt(drag.order, drag.id, e.clientY) })}
            onPointerUp={drop}
            onPointerCancel={() => setDrag(undefined)}
            onKeyDown={(e) => {
              if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
              e.preventDefault();
              step(i, e.key === "ArrowUp" ? -1 : 1);
            }}
            className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted/70 active:cursor-grabbing"
          >
            <Grip />
          </button>
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

/** `order` with `id` moved to where the pointer is, among the other rows on screen. */
function dropAt(order: Container[], id: string, y: number) {
  const rows = [...document.querySelectorAll<HTMLElement>("[data-container]")].filter((row) => row.dataset.container !== id);
  const at = rows.filter((row) => {
    const r = row.getBoundingClientRect();
    return r.top + r.height / 2 < y;
  }).length;
  const rest = order.filter((c) => c.id !== id);
  return [...rest.slice(0, at), order.find((c) => c.id === id)!, ...rest.slice(at)];
}

function Grip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      {[2, 8, 14].flatMap((y) => [<circle key={`a${y}`} cx="2.5" cy={y} r="1.5" />, <circle key={`b${y}`} cx="7.5" cy={y} r="1.5" />])}
    </svg>
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

/** Text that commits on blur or Enter, like NumberInput. */
function TextInput({ value, onCommit, className = "" }: { value: string; onCommit: (value: string) => void; className?: string }) {
  const [draft, setDraft] = useState<string>();
  const commit = () => {
    const text = draft?.trim();
    if (text && text !== value) onCommit(text);
    setDraft(undefined);
  };
  return (
    <input
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={`bg-transparent outline-none ${className}`}
    />
  );
}

function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={`Remove ${label}`} className="-mr-1 w-6 text-center text-lg leading-none text-muted">
      ×
    </button>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline justify-between px-1 text-xs font-medium tracking-wide text-muted uppercase">
        {title}
        {aside}
      </h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
    </section>
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
