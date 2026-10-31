import { add, allFoods, scale, zero } from "./nutrition";
import type { State } from "./state";
import type { Day, Entry, Nutrients } from "./types";

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
  const own = state.days.get(date);
  if (own) return own;
  const previous = [...state.days.keys()].filter((d) => d < date).sort().at(-1);
  const carried = previous ? state.days.get(previous)! : undefined;
  return { date, phase: carried?.phase ?? "maintain", offset: carried?.offset, steps: 0, extraKcal: 0 };
}

/** Mean of the weigh-ins in the 7 days ending on date, else the latest one before it. */
export function trendWeight(state: State, date: string): number | undefined {
  const from = shiftDate(date, -6);
  const week = [...state.weights].filter(([d]) => d >= from && d <= date).map(([, kg]) => kg);
  if (week.length) return week.reduce((a, b) => a + b) / week.length;
  const before = [...state.weights.keys()].filter((d) => d <= date).sort().at(-1);
  return before ? state.weights.get(before) : undefined;
}

export function kcalTarget(state: State, day: Day): number {
  const { tdee, phaseOffsets, kcalPer1kSteps } = state.settings;
  const offset = day.offset ?? phaseOffsets[day.phase];
  return tdee + offset + (day.steps / 1000) * kcalPer1kSteps + day.extraKcal;
}

/** Daily targets, carried over from the sheet. */
export function targets(state: State, date: string): Nutrients {
  const kcal = kcalTarget(state, dayOf(state, date));
  return {
    kcal,
    prot: (trendWeight(state, date) ?? 0) * state.settings.proteinPerKg,
    fiber: (kcal / 1000) * 15,
    satFat: (kcal * 0.07) / 9,
    unsatFat: (kcal * 0.25) / 9,
    salt: 4.5,
  };
}

export function entriesOn(state: State, date: string): Entry[] {
  return [...state.entries.values()].filter((entry) => entry.date === date);
}

/** Everything logged for the day, planned or done; a skipped plan is simply removed. */
export function intake(state: State, date: string): Nutrients {
  const foods = allFoods(state);
  return entriesOn(state, date).reduce((sum, entry) => {
    const food = foods.get(entry.foodId);
    return food ? add(sum, scale(food, entry.amount)) : sum;
  }, zero());
}
