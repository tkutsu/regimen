import { useMemo, useState } from "react";
import { dayOf, entriesOn, intake, localDate, shiftDate, targets, trendWeight } from "../domain/day";
import { allFoods, parseAmount, pickableFoods, scale } from "../domain/nutrition";
import { recentFoodIds } from "../domain/search";
import { newId, type State } from "../domain/state";
import type { Change, Day, Entry, Food, Phase, Variant } from "../domain/types";
import { NumberField } from "./fields";
import { FoodPicker } from "./FoodPicker";
import { Remaining } from "./Remaining";

type Props = { state: State; commit: (...changes: Change[]) => void };

export function Today({ state, commit }: Props) {
  const [date, setDate] = useState(localDate);
  const [picking, setPicking] = useState(false);

  const foods = useMemo(() => allFoods(state), [state]);
  const pickable = useMemo(() => pickableFoods(state), [state]);
  const day = dayOf(state, date);
  const entries = entriesOn(state, date).sort((a, b) => Number(a.done) - Number(b.done));
  const yesterday = entriesOn(state, shiftDate(date, -1));
  const trend = trendWeight(state, date);

  const setDay = (patch: Partial<Day>) => commit({ type: "day.upsert", day: { ...day, ...patch } });
  const putEntry = (entry: Entry) =>
    commit(entry.amount > 0 ? { type: "entry.upsert", entry } : { type: "entry.delete", entryId: entry.id });
  const add = (food: Food, amount: number, done: boolean, variant?: Variant) => {
    const entry = { id: newId(), date, foodId: food.id, amount, done, variant: variant?.name, factor: variant?.factor };
    // A reference-table food becomes one of yours, synced like any other.
    const save: Change[] = foods.has(food.id) ? [] : [{ type: "food.upsert", food }];
    commit(...save, { type: "entry.upsert", entry });
    setPicking(false);
  };
  const copyYesterday = () =>
    commit(...yesterday.map((entry): Change => ({ type: "entry.upsert", entry: { ...entry, id: newId(), date, done: false } })));

  return (
    <div className="flex flex-col gap-4 pb-24">
      <DateNav date={date} onChange={setDate} />

      <div className="flex gap-1 rounded-xl bg-line/50 p-1 text-sm">
        {(["cut", "maintain", "bulk"] as Phase[]).map((phase) => (
          <button
            key={phase}
            onClick={() => setDay({ phase, offset: undefined })}
            className={`flex-1 rounded-lg py-1.5 capitalize ${day.phase === phase ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
          >
            {phase}
          </button>
        ))}
      </div>
      {day.offset !== undefined && day.offset !== state.settings.phaseOffsets[day.phase] && (
        <p className="-mt-2 text-center text-xs text-muted">
          custom offset {day.offset > 0 ? "+" : ""}
          {day.offset} kcal
        </p>
      )}

      <Remaining target={targets(state, date)} eaten={intake(state, date)} />

      <div className="grid grid-cols-3 gap-2">
        <NumberField
          label="weight (kg)"
          value={state.weights.get(date)}
          placeholder={trend?.toFixed(1)}
          onCommit={(kg) => kg > 0 && commit({ type: "weight", date, kg })}
        />
        <NumberField label="steps (k)" value={day.steps / 1000} onCommit={(k) => setDay({ steps: Math.round(k * 1000) })} />
        <NumberField label="extra kcal" value={day.extraKcal} onCommit={(extraKcal) => setDay({ extraKcal })} />
      </div>

      <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} food={foods.get(entry.foodId)} onChange={putEntry} />
        ))}
        {entries.length === 0 && (
          <li className="flex items-center justify-between px-4 py-3 text-sm text-muted">
            Nothing logged
            {yesterday.length > 0 && (
              <button onClick={copyYesterday} className="text-accent">
                Plan yesterday's {yesterday.length}
              </button>
            )}
          </li>
        )}
      </ul>

      <button
        onClick={() => setPicking(true)}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 mx-auto max-w-md rounded-2xl bg-accent py-3.5 font-medium text-bg shadow-lg"
      >
        Add food
      </button>
      {picking && (
        <FoodPicker
          foods={pickable}
          recentIds={recentFoodIds(state)}
          containers={state.settings.containers}
          onAdd={add}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function DateNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const today = localDate();
  const label =
    date === today
      ? "Today"
      : date === shiftDate(today, -1)
        ? "Yesterday"
        : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <nav className="flex items-center justify-between">
      <button onClick={() => onChange(shiftDate(date, -1))} className="px-3 py-1 text-2xl text-muted">
        ‹
      </button>
      <button onClick={() => onChange(today)} className="text-lg font-semibold">
        {label}
      </button>
      <button onClick={() => onChange(shiftDate(date, 1))} className="px-3 py-1 text-2xl text-muted">
        ›
      </button>
    </nav>
  );
}

function EntryRow({ entry, food, onChange }: { entry: Entry; food?: Food; onChange: (entry: Entry) => void }) {
  const [open, setOpen] = useState(false);
  const unit = food?.basis === "item" ? "×" : "g";
  const kcal = food ? scale(food, entry.amount, entry.factor).kcal : 0;
  return (
    <li className="border-b border-line last:border-b-0">
      <div className={`flex items-center gap-3 px-3 py-2 ${entry.done ? "" : "text-muted"}`}>
        <button
          onClick={() => onChange({ ...entry, done: !entry.done })}
          aria-label={entry.done ? "Mark planned" : "Mark eaten"}
          className={`size-5 shrink-0 rounded-full border-2 ${entry.done ? "border-accent bg-accent" : "border-line"}`}
        />
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
          <span className="truncate">
            {food?.name ?? "unknown food"}
            {entry.variant && <span className="text-muted"> · {entry.variant}</span>}
          </span>
          <span className="ml-auto shrink-0 text-sm">
            {+entry.amount.toFixed(1)}
            <span className="text-muted">{unit}</span>
          </span>
        </button>
        <span className="w-12 text-right text-sm text-muted">{Math.round(kcal)}</span>
        <button onClick={() => onChange({ ...entry, amount: 0 })} aria-label="Remove" className="px-1 text-muted">
          ×
        </button>
      </div>
      {open && (
        <AmountEditor
          amount={entry.amount}
          unit={unit}
          onCommit={(amount) => {
            onChange({ ...entry, amount });
            setOpen(false);
          }}
        />
      )}
    </li>
  );
}

/** Adds to, removes from, or replaces an entry's amount. "+50" / "-20" typed directly also work. */
function AmountEditor({ amount, unit, onCommit }: { amount: number; unit: string; onCommit: (amount: number) => void }) {
  const [text, setText] = useState("");
  const value = parseAmount(text);
  const apply = (next: number | undefined) => next !== undefined && onCommit(Math.max(0, next));
  return (
    <div className="flex items-center gap-2 px-3 pb-3">
      <input
        autoFocus
        inputMode="decimal"
        value={text}
        placeholder={unit}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply(parseAmount(text, amount))}
        className="w-20 rounded-lg border border-line bg-bg px-2 py-1.5 text-right outline-none focus:border-accent"
      />
      <button disabled={value === undefined} onClick={() => apply(amount - value!)} className="flex-1 rounded-lg border border-line py-1.5 text-sm disabled:opacity-40">
        − Remove
      </button>
      <button disabled={value === undefined} onClick={() => apply(amount + value!)} className="flex-1 rounded-lg border border-line py-1.5 text-sm disabled:opacity-40">
        + Add
      </button>
      <button disabled={value === undefined} onClick={() => apply(value)} className="flex-1 rounded-lg border border-line py-1.5 text-sm disabled:opacity-40">
        Set
      </button>
    </div>
  );
}
