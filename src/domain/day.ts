import { add, allFoods, scale, zero } from "./nutrition";
import type { State } from "./state";
import type { Day, Entry, Food, Limited, Nutrients, Range } from "./types";

/** Today's date in local time, as YYYY-MM-DD. */
export function localDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

/** The day's settings. A day never set carries the phase and offset of the last one that was. */
export function dayOf(state: State, date: string): Day {
  return daysFrom(state, date, date)[0];
}

/** `dayOf` for every date from `from` to `to`, in one pass over the days set. */
export function daysFrom(state: State, from: string, to: string): Day[] {
  const set = [...state.days.keys()].sort();
  const out: Day[] = [];
  let carried: Day | undefined;
  for (let date = from, i = 0; date <= to; date = shiftDate(date, 1)) {
    while (i < set.length && set[i] <= date) carried = state.days.get(set[i++]);
    out.push(carried?.date === date ? carried : { date, phase: carried?.phase ?? "maintain", offset: carried?.offset, steps: 0, extraKcal: 0 });
  }
  return out;
}

/** Mean of the weigh-ins in the 7 days ending on date, else the latest one before it. */
export function trendWeight(state: State, date: string): number | undefined {
  const from = shiftDate(date, -6);
  const week = [...state.weights].filter(([d]) => d >= from && d <= date).map(([, kg]) => kg);
  if (week.length) return week.reduce((a, b) => a + b) / week.length;
  const before = [...state.weights.keys()].filter((d) => d <= date).sort().at(-1);
  return before ? state.weights.get(before) : undefined;
}

/**
 * Maintenance as it was set on that date, so past targets stay what they were
 * when the setting changes. Before the first change, the first value set.
 */
export function tdeeOn(state: State, date: string): number {
  const history = state.tdeeHistory;
  return history.findLast((change) => change.date <= date)?.tdee ?? history[0]?.tdee ?? state.settings.tdee;
}

export function kcalTarget(state: State, day: Day): number {
  const { phaseOffsets, kcalPer1kSteps } = state.settings;
  const offset = day.offset ?? phaseOffsets[day.phase];
  return tdeeOn(state, day.date) + offset + (day.steps / 1000) * kcalPer1kSteps + day.extraKcal;
}

export type Targets = { kcal: number } & Record<Limited, Range>;

export const LIMIT_UNITS: Record<Limited, string> = {
  prot: "g/kg",
  fiber: "g",
  satFat: "% kcal",
  unsatFat: "% kcal",
  salt: "g",
  sugar: "% kcal",
};

/** The day's kcal target and every limit in grams. Shares of kcal use 9 kcal/g for fat, 4 for sugar. */
export function targets(state: State, date: string): Targets {
  const kcal = kcalTarget(state, dayOf(state, date));
  const kg = trendWeight(state, date) ?? 0;
  const grams: Record<Limited, (value: number) => number> = {
    prot: (perKg) => perKg * kg,
    fiber: (g) => g,
    satFat: (pct) => (kcal * pct) / 100 / 9,
    unsatFat: (pct) => (kcal * pct) / 100 / 9,
    salt: (g) => g,
    sugar: (pct) => (kcal * pct) / 100 / 4,
  };
  const out = { kcal } as Targets;
  for (const [key, toGrams] of Object.entries(grams) as [Limited, (value: number) => number][]) {
    const { min, max } = state.settings.limits[key];
    out[key] = { min: min === undefined ? undefined : toGrams(min), max: max === undefined ? undefined : toGrams(max) };
  }
  return out;
}

export function entriesOn(state: State, date: string): Entry[] {
  return [...state.entries.values()].filter((entry) => entry.date === date);
}

/**
 * Staple entries the day doesn't have yet: from the day a staple was added on, and
 * never again on a day it was removed from. The id is fixed per staple and day, so two
 * devices planning the same day write the same entry.
 */
export function missingStaples(state: State, date: string): Entry[] {
  return state.settings.staples
    .filter((staple) => staple.from <= date)
    .map((staple) => ({
      id: `${staple.id}@${date}`,
      date,
      foodId: staple.foodId,
      amount: staple.amount,
      done: false,
      variant: staple.variant,
      factor: staple.factor,
      staple: staple.id,
    }))
    .filter((entry) => !state.entries.has(entry.id) && !state.removed.has(entry.id));
}

export type Intake = Nutrients & { sugarIncomplete: boolean };

/** Logged totals and whether sugar is only a known subtotal; `done` picks eaten or planned. */
export function intake(state: State, date: string, done?: boolean): Intake {
  const entries = entriesOn(state, date).filter((entry) => done === undefined || entry.done === done);
  const foods = allFoods(state);
  const sugarIncomplete = entries.some((entry) => entry.amount * (entry.factor ?? 1) > 0 && foods.get(entry.foodId)?.sugar === undefined);
  return { ...sum(entries, foods), sugarIncomplete };
}

/** What the entries add up to; one whose food is gone counts as nothing. */
export function sum(entries: Entry[], foods: Map<string, Food>): Nutrients {
  return entries.reduce((total, entry) => {
    const food = foods.get(entry.foodId);
    return food ? add(total, scale(food, entry.amount, entry.factor)) : total;
  }, zero());
}
