import { useEffect, useMemo, useRef, useState } from "react";
import { dayOf, entriesOn, intake, listedEntries, localDate, missingStaples, ratesOn, shiftDate, targets, trendWeight } from "../domain/day";
import { allFoods, entryFood, parseAmount, pickableFoods, scale, toggleFav, usedName } from "../domain/nutrition";
import { recentFoodIds } from "../domain/search";
import { newId, type State } from "../domain/state";
import { newestFirst, workoutOn } from "../domain/training";
import type { Change, Day, Entry, Food, Nutrients, Phase, Variant } from "../domain/types";
import type { Commit } from "../store";
import { NumberField, Tick } from "./fields";
import { FoodPicker } from "./FoodPicker";
import { SettingsButton } from "./Header";
import { transition } from "./motion";
import { Remaining } from "./Remaining";
import { useReorder } from "./reorder";
import { useOfferUndo } from "./undo";

/** The day is shared with Training; `onTraining` opens its workout there. */
type Props = { state: State; commit: Commit; date: string; onDate: (date: string) => void; onTraining: () => void };

export function Today({ state, commit, date, onDate, onTraining }: Props) {
  const [picking, setPicking] = useState(false);
  // The phase changes rarely, so its control opens from the line under the date.
  const [phasing, setPhasing] = useState(false);
  const [extras, setExtras] = useState(false);
  const offerUndo = useOfferUndo();
  const [shown, setShown] = useState<keyof Nutrients>();

  const foods = useMemo(() => allFoods(state), [state]);
  const pickable = useMemo(() => pickableFoods(state), [state]);
  const day = dayOf(state, date);
  const entries = listedEntries(state, date);
  const planned = useReorder(
    entries.filter((entry) => !entry.done),
    (entry) => entry.id,
    (next) => commit(...next.flatMap((entry, order): Change[] => (entry.order === order ? [] : [{ type: "entry.upsert", entry: { ...entry, order } }]))),
  );
  // Staples are planned anyway, so "Plan yesterday's" copies the rest.
  const yesterday = entriesOn(state, shiftDate(date, -1)).filter((entry) => !entry.staple);
  const onlyStaples = entries.every((entry) => entry.staple);
  const trend = trendWeight(state, date);
  const target = targets(state, date);
  const workout = useMemo(() => workoutOn(newestFirst(state.sessions.values()), date), [state.sessions, date]);
  const setsDone = workout.sets.filter((set) => set.done).length;
  const customOffset = day.offset !== undefined && day.offset !== ratesOn(state, date).phaseOffsets[day.phase] ? day.offset : undefined;
  const showExtras = extras || day.extraKcal !== 0 || (day.rolloverKcal ?? 0) !== 0;

  // Today and later days get their staples when opened; past days stay as they were.
  useEffect(() => {
    if (date < localDate()) return;
    const missing = missingStaples(state, date);
    if (missing.length) commit(...missing.map((entry): Change => ({ type: "entry.upsert", entry })));
  }, [state, date, commit]);

  const setDay = (patch: Partial<Day>) => commit({ type: "day.upsert", day: { ...day, ...patch } });
  const putEntry = async (entry: Entry) => {
    if (entry.amount > 0) return commit({ type: "entry.upsert", entry });
    const before = state.entries.get(entry.id);
    if ((await commit({ type: "entry.delete", entryId: entry.id })) && before) {
      offerUndo(`Removed ${usedName(entryFood(before, foods))}`, { type: "entry.upsert", entry: before });
    }
  };
  const add = async (food: Food, amount: number, done: boolean, variant?: Variant) => {
    const entry = { id: newId(), date, foodId: food.id, amount, done, variant: variant?.name, factor: variant?.factor };
    // A reference-table food becomes one of yours, synced like any other.
    const save: Change[] = foods.has(food.id) ? [] : [{ type: "food.upsert", food }];
    if (await commit(...save, { type: "entry.upsert", entry })) setPicking(false);
  };
  const show = (key: keyof Nutrients) => transition(() => setShown(shown === key ? undefined : key));
  const copyYesterday = () =>
    commit(...yesterday.map((entry): Change => ({ type: "entry.upsert", entry: { ...entry, id: newId(), date, done: false } })));

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div>
        <DateNav date={date} onChange={onDate} />
        <button onClick={() => transition(() => setPhasing(!phasing))} aria-expanded={phasing} aria-label={`Phase: ${day.phase}`} className="-mt-1 flex min-h-8 items-center gap-1 text-sm text-muted">
          <span className="capitalize">{day.phase}</span>
          {customOffset !== undefined && ` ${customOffset > 0 ? "+" : ""}${customOffset}`} · {Math.round(target.kcal)} kcal
          <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-4 transition-transform ${phasing ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {phasing && (
          <div className="rise mt-2 flex gap-1 rounded-xl bg-line/50 p-1 text-sm">
            {(["cut", "maintain", "bulk"] as Phase[]).map((phase) => (
              <button
                key={phase}
                onClick={() => {
                  setDay({ phase, offset: undefined });
                  transition(() => setPhasing(false));
                }}
                aria-pressed={day.phase === phase}
                className={`min-h-9 flex-1 rounded-lg capitalize transition-colors ${day.phase === phase ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
              >
                {phase}
              </button>
            ))}
          </div>
        )}
      </div>

      <Remaining target={target} eaten={intake(state, date, true)} planned={intake(state, date, false)} shown={shown} onShow={show} />

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={state.weights.has(date) || trend === undefined ? "weight" : "weight · trend"}
          unit="kg"
          value={state.weights.get(date)}
          placeholder={trend?.toFixed(1)}
          onCommit={(kg) => kg > 0 && commit({ type: "weight", date, kg })}
        />
        <NumberField label="steps" unit="k" value={day.steps / 1000} onCommit={(k) => setDay({ steps: Math.round(k * 1000) })} />
        {showExtras && (
          <>
            <NumberField label="extra burned" unit="kcal" value={day.extraKcal} onCommit={(extraKcal) => setDay({ extraKcal })} hint="Calories burned today beyond your steps." />
            <NumberField label="rollover" unit="kcal" value={day.rolloverKcal ?? 0} onCommit={(rolloverKcal) => setDay({ rolloverKcal })} hint="Calories moved from the previous day. Negative if you went over." />
          </>
        )}
      </div>
      {!showExtras && (
        <button onClick={() => transition(() => setExtras(true))} className="-mt-3 min-h-9 self-start px-1 text-sm text-accent">
          + Extra burned or rollover
        </button>
      )}

      <ul ref={planned.holdList} className="flow overflow-hidden rounded-2xl border border-line bg-surface">
        {planned.shown.map((entry) => (
          <EntryRow key={entry.id} entry={entry} food={entryFood(entry, foods)} shown={shown} onChange={putEntry} hold={planned.hold(entry)} dragging={planned.dragging === entry.id} />
        ))}
        {entries.filter((entry) => entry.done).map((entry) => (
          <EntryRow key={entry.id} entry={entry} food={entryFood(entry, foods)} shown={shown} onChange={putEntry} />
        ))}
        {onlyStaples && (entries.length === 0 || yesterday.length > 0) && (
          <li className="flex items-center justify-between px-4 py-3 text-sm text-muted">
            {entries.length === 0 ? "Nothing logged" : "Only staples so far"}
            {yesterday.length > 0 && (
              <button onClick={copyYesterday} className="text-accent">
                Plan yesterday's {yesterday.length}
              </button>
            )}
          </li>
        )}
      </ul>

      <button onClick={onTraining} className="flex min-h-11 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">Workout</span>
          <span className={`block truncate ${workout.sets.length ? "" : "text-muted"}`}>
            {workout.sets.length ? `${workout.name} · ${setsDone} of ${workout.sets.length} ${workout.sets.length === 1 ? "set" : "sets"} done` : "Nothing logged"}
          </span>
        </span>
        <span aria-hidden className="text-2xl leading-none text-muted">›</span>
      </button>

      <button
        data-enter
        onClick={() => setPicking(true)}
        className="page-actions fixed right-4 bottom-[calc(var(--tabs)+0.75rem)] left-4 z-[2] mx-auto max-w-md rounded-2xl bg-accent py-3.5 font-medium text-bg shadow-lg"
      >
        Add food
      </button>
      {picking && (
        <FoodPicker
          foods={pickable}
          recentIds={recentFoodIds(state)}
          containers={state.settings.containers}
          onAdd={add}
          onToggleFav={(food) => commit(...toggleFav(state, food.id))}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

/**
 * The screen's header: the day as its title, the arrows together so they stay put as the
 * title changes width. Change days with them, a horizontal swipe/drag, or vertical wheel
 * input over the bar; the title goes back to today.
 */
export function DateNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const bar = useRef<HTMLElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number }>(undefined);
  const dragged = useRef(false);
  const wheel = useRef({ delta: 0, at: 0, stepped: -Infinity });

  // A non-passive listener consumes wheel input here instead of also scrolling the page.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const scroll = (e: WheelEvent) => {
      if (e.ctrlKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      const gesture = wheel.current;
      if (now - gesture.at > 180 || Math.sign(e.deltaY) !== Math.sign(gesture.delta)) gesture.delta = 0;
      gesture.at = now;
      if (now - gesture.stepped < 180) return;
      gesture.delta += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
      if (Math.abs(gesture.delta) < 40) return;
      gesture.stepped = now;
      onChange(shiftDate(date, Math.sign(gesture.delta)));
      gesture.delta = 0;
    };
    el.addEventListener("wheel", scroll, { passive: false });
    return () => el.removeEventListener("wheel", scroll);
  }, [date, onChange]);

  const today = localDate();
  const label =
    date === today
      ? "Today"
      : date === shiftDate(today, -1)
        ? "Yesterday"
        : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <nav
      ref={bar}
      aria-label="Day"
      title="Swipe or drag left/right, or scroll up/down to change days"
      className="flex min-h-12 touch-pan-y cursor-grab items-center gap-1 select-none active:cursor-grabbing"
      onPointerDown={(e) => {
        if (e.button !== 0 || !e.isPrimary) return;
        dragged.current = false;
        drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (!start || start.pointer !== e.pointerId) return;
        const dx = e.clientX - start.x;
        if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(e.clientY - start.y)) return;
        dragged.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        const start = drag.current;
        if (!start || start.pointer !== e.pointerId) return;
        drag.current = undefined;
        const dx = e.clientX - start.x;
        if (dragged.current && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
          onChange(shiftDate(date, dx < 0 ? 1 : -1));
        }
      }}
      onPointerCancel={() => { drag.current = undefined; }}
      onLostPointerCapture={(e) => {
        // Touch capture moves from the pressed button to this bar when dragging starts.
        if (e.target === e.currentTarget && drag.current?.pointer === e.pointerId) drag.current = undefined;
      }}
      onClickCapture={(e) => {
        if (!dragged.current || e.detail === 0) return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">
        <button onClick={() => onChange(today)} aria-live="polite" aria-atomic="true">
          {label}
        </button>
      </h1>
      <button aria-label="Previous day" onClick={() => onChange(shiftDate(date, -1))} className="grid size-11 place-items-center text-2xl text-muted">
        ‹
      </button>
      <button aria-label="Next day" onClick={() => onChange(shiftDate(date, 1))} className="grid size-11 place-items-center text-2xl text-muted">
        ›
      </button>
      <SettingsButton />
    </nav>
  );
}

type RowProps = {
  entry: Entry;
  food?: Food;
  shown?: keyof Nutrients;
  onChange: (entry: Entry) => void;
  /** Given to planned rows, which can be held and dragged. */
  hold?: ReturnType<ReturnType<typeof useReorder<Entry>>["hold"]>;
  dragging?: boolean;
};

/** An entry's food and amount, or with `shown`, its share of that total. */
function EntryRow({ entry, food, shown, onChange, hold, dragging }: RowProps) {
  const [open, setOpen] = useState(false);
  const unit = food?.basis === "item" ? "×" : "g";
  return (
    <li data-row={hold && entry.id} className={`border-b border-line last:border-b-0 ${dragging ? "bg-line/40" : ""}`}>
      <div className={`flex items-center gap-3 px-3 py-2.5 ${entry.done ? "" : "text-muted"}`}>
        <Tick done={entry.done} onClick={() => onChange({ ...entry, done: !entry.done })} label={`${entry.done ? "Unmark" : "Mark"} ${food?.name ?? "food"} eaten`} />
        <button {...hold} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left select-none">
          <span className="truncate">
            {usedName(food)}
            {entry.variant && <span className="text-muted"> · {entry.variant}</span>}
          </span>
          {shown ? (
            <Share food={food} entry={entry} shown={shown} />
          ) : (
            <span className="ml-auto shrink-0 text-sm">
              {+entry.amount.toFixed(1)}
              <span className="text-muted">{unit}</span>
            </span>
          )}
        </button>
        <button onClick={() => onChange({ ...entry, amount: 0 })} aria-label={`Remove ${food?.name ?? "food"}`} className="-my-2 -mr-2 grid size-10 shrink-0 place-items-center text-muted">
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

/** What an entry adds to a total: kcal whole, grams to a tenth below 10; "?" when the food doesn't say. */
function Share({ food, entry, shown }: { food?: Food; entry: Entry; shown: keyof Nutrients }) {
  const known = food && food[shown] !== undefined;
  const n = known ? scale(food, entry.amount, entry.factor)[shown] : 0;
  return (
    <span className={`ml-auto shrink-0 text-sm ${entry.done ? "text-accent" : "text-accent/60"}`}>
      {known ? (
        <>
          {shown === "kcal" || n >= 10 ? Math.round(n) : +n.toFixed(1)}
          <span className="text-muted">{shown === "kcal" ? "kcal" : "g"}</span>
        </>
      ) : (
        "?"
      )}
    </span>
  );
}

/** Adds to, removes from, or replaces an entry's amount. "+50" / "-20" typed directly also work. */
function AmountEditor({ amount, unit, onCommit }: { amount: number; unit: string; onCommit: (amount: number) => void }) {
  const [text, setText] = useState("");
  const value = parseAmount(text);
  const apply = (next: number | undefined) => next !== undefined && onCommit(Math.max(0, next));
  return (
    <div className="rise flex items-center gap-2 px-3 pb-3">
      <input
        autoFocus
        inputMode="text"
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
