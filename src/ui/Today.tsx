import { useMemo, useState } from "react";
import { dayOf, entriesOn, intake, localDate, shiftDate, targets } from "../domain/day";
import { allFoods, scale } from "../domain/nutrition";
import { newId, type State } from "../domain/state";
import type { Change, Day, Entry, Food, Phase } from "../domain/types";
import { FoodPicker } from "./FoodPicker";
import { Remaining } from "./Remaining";

type Props = { state: State; commit: (...changes: Change[]) => void };

export function Today({ state, commit }: Props) {
  const [date, setDate] = useState(localDate);
  const [picking, setPicking] = useState(false);

  const foods = useMemo(() => allFoods(state), [state]);
  const day = dayOf(state, date);
  const entries = entriesOn(state, date).sort((a, b) => Number(a.done) - Number(b.done));
  const yesterday = entriesOn(state, shiftDate(date, -1));

  const setDay = (patch: Partial<Day>) => commit({ type: "day.upsert", day: { ...day, ...patch } });
  const putEntry = (entry: Entry) =>
    commit(entry.amount > 0 ? { type: "entry.upsert", entry } : { type: "entry.delete", entryId: entry.id });
  const add = (food: Food, amount: number, done: boolean) => {
    putEntry({ id: newId(), date, foodId: food.id, amount, done });
    setPicking(false);
  };
  const copyYesterday = () =>
    commit(...yesterday.map((entry): Change => ({ type: "entry.upsert", entry: { ...entry, id: newId(), date, done: false } })));

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
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
        <p className="-mt-2 text-center text-xs text-muted">custom offset {day.offset > 0 ? "+" : ""}{day.offset} kcal</p>
      )}

      <Remaining target={targets(state, date)} eaten={intake(state, date)} />

      <div className="grid grid-cols-2 gap-2">
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
      {picking && <FoodPicker foods={foods} onAdd={add} onClose={() => setPicking(false)} />}
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
  const item = food?.basis === "item";
  const kcal = food ? scale(food, entry.amount).kcal : 0;
  return (
    <li className={`flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 ${entry.done ? "" : "text-muted"}`}>
      <button
        onClick={() => onChange({ ...entry, done: !entry.done })}
        aria-label={entry.done ? "Mark planned" : "Mark eaten"}
        className={`size-5 shrink-0 rounded-full border-2 ${entry.done ? "border-accent bg-accent" : "border-line"}`}
      />
      <span className="min-w-0 flex-1 truncate">{food?.name ?? "unknown food"}</span>
      <AmountInput value={entry.amount} unit={item ? "×" : "g"} onCommit={(amount) => onChange({ ...entry, amount })} />
      <span className="w-12 text-right text-sm text-muted">{Math.round(kcal)}</span>
      <button onClick={() => onChange({ ...entry, amount: 0 })} aria-label="Remove" className="px-1 text-muted">
        ×
      </button>
    </li>
  );
}

/** Edits locally and commits on blur or Enter, so typing doesn't write an event per keystroke. */
function useDraft(value: number, onCommit: (value: number) => void) {
  const [draft, setDraft] = useState<string>();
  const commit = () => {
    const parsed = Number((draft ?? "").replace(",", "."));
    if (draft !== undefined && Number.isFinite(parsed) && parsed !== value) onCommit(parsed);
    setDraft(undefined);
  };
  return {
    inputMode: "decimal" as const,
    value: draft ?? String(value),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && e.currentTarget.blur(),
  };
}

function AmountInput({ value, unit, onCommit }: { value: number; unit: string; onCommit: (value: number) => void }) {
  return (
    <label className="flex items-baseline gap-0.5 text-sm">
      <input {...useDraft(value, onCommit)} className="w-12 bg-transparent text-right outline-none focus:text-accent" />
      <span className="text-muted">{unit}</span>
    </label>
  );
}

function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  return (
    <label className="rounded-xl border border-line bg-surface px-3 py-2">
      <span className="block text-xs text-muted">{label}</span>
      <input {...useDraft(value, onCommit)} className="w-full bg-transparent text-lg outline-none" />
    </label>
  );
}
