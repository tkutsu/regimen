import { localDate } from "./day";
import type { Change, Day, Entry, Event, Exercise, Food, Recipe, Session, Settings, Workout } from "./types";

export type State = {
  foods: Map<string, Food>;
  entries: Map<string, Entry>;
  days: Map<string, Day>;
  weights: Map<string, number>;
  recipes: Map<string, Recipe>;
  exercises: Map<string, Exercise>;
  workouts: Map<string, Workout>;
  sessions: Map<string, Session>;
  settings: Settings;
  /** Every maintenance change with the local date it was made, oldest first. */
  tdeeHistory: { date: string; tdee: number }[];
  /** Deleted entries, so a staple removed from a day isn't planned there again. */
  removed: Set<string>;
};

export const defaultSettings: Settings = {
  tdee: 2300,
  phaseOffsets: { bulk: 100, maintain: 0, cut: -600 },
  kcalPer1kSteps: 37,
  limits: {
    prot: { min: 1.6 },
    fiber: { min: 30 },
    satFat: { max: 7 },
    unsatFat: { min: 25 },
    salt: { max: 4.5 },
    sugar: { max: 10 },
  },
  containers: [],
  staples: [],
  theme: "system",
  accentHue: 160,
};

/** Settings as written before limits had ranges. */
type Legacy = { proteinPerKg?: number; sugarPct?: number };

/**
 * Parses every device's log into one ordered list. Lines that fail to parse
 * (a half-synced tail) are skipped; duplicates (Syncthing conflict copies) collapse by id.
 */
export function parseLogs(texts: string[]): Event[] {
  const byId = new Map<string, Event>();
  for (const line of texts.flatMap((text) => text.split("\n"))) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Event;
      if (event.id && event.t && event.type) byId.set(event.id, event);
    } catch {
      // incomplete line, still syncing
    }
  }
  return [...byId.values()].sort(
    (a, b) => a.t.localeCompare(b.t) || a.dev.localeCompare(b.dev) || a.id.localeCompare(b.id),
  );
}

/** Folds ordered events into state; for every entity the last write wins. */
export function fold(events: Event[]): State {
  const state: State = {
    foods: new Map(),
    entries: new Map(),
    days: new Map(),
    weights: new Map(),
    recipes: new Map(),
    exercises: new Map(),
    workouts: new Map(),
    sessions: new Map(),
    settings: defaultSettings,
    tdeeHistory: [],
    removed: new Set(),
  };
  for (const event of events) apply(state, event);
  return state;
}

export function apply(state: State, event: Event): void {
  switch (event.type) {
    case "food.upsert":
      state.foods.set(event.food.id, event.food);
      break;
    case "food.delete":
      state.foods.delete(event.foodId);
      break;
    case "entry.upsert":
      state.entries.set(event.entry.id, event.entry);
      break;
    case "entry.delete":
      state.entries.delete(event.entryId);
      state.removed.add(event.entryId);
      break;
    case "day.upsert":
      state.days.set(event.day.date, event.day);
      break;
    case "weight":
      state.weights.set(event.date, event.kg);
      break;
    case "recipe.upsert":
      state.recipes.set(event.recipe.id, event.recipe);
      break;
    case "recipe.delete":
      state.recipes.delete(event.recipeId);
      break;
    case "exercise.upsert":
      state.exercises.set(event.exercise.id, event.exercise);
      break;
    case "exercise.delete":
      state.exercises.delete(event.exerciseId);
      break;
    case "workout.upsert":
      state.workouts.set(event.workout.id, event.workout);
      break;
    case "workout.delete":
      state.workouts.delete(event.workoutId);
      break;
    case "session.upsert":
      state.sessions.set(event.session.id, event.session);
      break;
    case "session.delete":
      state.sessions.delete(event.sessionId);
      break;
    case "settings": {
      const { proteinPerKg, sugarPct, ...patch } = event.settings as Partial<Settings> & Legacy;
      const limits = { ...state.settings.limits, ...patch.limits };
      if (proteinPerKg !== undefined) limits.prot = { ...limits.prot, min: proteinPerKg };
      if (sugarPct !== undefined) limits.sugar = { ...limits.sugar, max: sugarPct };
      state.settings = { ...state.settings, ...patch, limits };
      if (event.settings.tdee !== undefined)
        state.tdeeHistory.push({ date: localDate(new Date(event.t)), tdee: event.settings.tdee });
      break;
    }
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function stamp(change: Change, dev: string, now = new Date()): Event {
  return { ...change, id: newId(), t: now.toISOString(), dev } as Event;
}
