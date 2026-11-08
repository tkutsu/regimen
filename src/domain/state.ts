import { localDate } from "./day";
import type { Change, Day, Entry, Event, Exercise, Food, Recipe, Session, Settings, SettingsPatch, Workout } from "./types";

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
  /** Phase offsets and kcal per 1000 steps with the local date they were set, oldest first. */
  rateHistory: ({ date: string } & Pick<Settings, "phaseOffsets" | "kcalPer1kSteps">)[];
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
 * Parses every device's log into one ordered list, with `extra` events not read from
 * them. Lines that fail to parse (a half-synced tail) are skipped; duplicates (Syncthing
 * conflict copies) collapse by id.
 */
export function parseLogs(texts: string[], extra: Event[] = []): Event[] {
  const byId = new Map<string, Event>();
  for (const line of texts.flatMap((text) => text.split("\n"))) {
    const event = line.trim() ? readLine(line) : undefined;
    if (event) byId.set(event.id, event);
  }
  for (const event of extra) byId.set(event.id, event);
  return [...byId.values()].sort(
    (a, b) => a.t.localeCompare(b.t) || a.dev.localeCompare(b.dev) || a.id.localeCompare(b.id),
  );
}

/**
 * A line's event. A write cut short leaves a torn line that the next write appends to,
 * as in `{"type":"wei{"type":"food.upsert",…}`, so the event is read from the last
 * place where one starts.
 */
function readLine(line: string): Event | undefined {
  for (let at = 0; at !== -1; at = line.indexOf("{", at + 1)) {
    try {
      const event = JSON.parse(line.slice(at)) as Event;
      if (event.id && event.t && event.type) return event;
    } catch {
      // incomplete, or torn: try from the next brace
    }
  }
}

/**
 * Folds ordered events into state; for every entity the last write wins. An event
 * missing what its type needs (a hand edit, a newer version's shape) is skipped.
 */
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
    rateHistory: [{ date: "", phaseOffsets: defaultSettings.phaseOffsets, kcalPer1kSteps: defaultSettings.kcalPer1kSteps }],
    removed: new Set(),
  };
  for (const event of events) {
    try {
      apply(state, event);
    } catch {
      // malformed: the rest of the history still loads
    }
  }
  return state;
}

/** What each event changes in place; settings are replaced whole, so they need no copy. */
const TOUCHES: Record<Event["type"], (keyof State)[]> = {
  "food.upsert": ["foods"],
  "food.delete": ["foods"],
  "entry.upsert": ["entries"],
  "entry.delete": ["entries", "removed"],
  "day.upsert": ["days"],
  weight: ["weights"],
  "recipe.upsert": ["recipes"],
  "recipe.delete": ["recipes"],
  settings: ["tdeeHistory", "rateHistory"],
  "exercise.upsert": ["exercises"],
  "exercise.delete": ["exercises"],
  "workout.upsert": ["workouts"],
  "workout.delete": ["workouts"],
  "session.upsert": ["sessions"],
  "session.delete": ["sessions"],
};

const copy = <T>(value: T): T =>
  (value instanceof Map ? new Map(value) : value instanceof Set ? new Set(value) : Array.isArray(value) ? [...value] : value) as T;

/**
 * The state after more events, as a new state. Only the collections they change are
 * copied, so the others stay the same objects and memos on them hold.
 */
export function applyEvents(state: State, events: Event[]): State {
  const next = { ...state };
  const copied = new Set<keyof State>();
  for (const event of events) {
    for (const key of TOUCHES[event.type].filter((key) => !copied.has(key))) {
      Object.assign(next, { [key]: copy(next[key]) });
      copied.add(key);
    }
    apply(next, event);
  }
  return next;
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
      // Limits merge per nutrient, so devices setting different ones don't undo each other.
      const { proteinPerKg, sugarPct, ...patch } = event.settings as SettingsPatch & Legacy;
      const limits = { ...state.settings.limits, ...patch.limits };
      if (proteinPerKg !== undefined) limits.prot = { ...limits.prot, min: proteinPerKg };
      if (sugarPct !== undefined) limits.sugar = { ...limits.sugar, max: sugarPct };
      state.settings = { ...state.settings, ...patch, limits };
      const date = localDate(new Date(event.t));
      if (patch.tdee !== undefined) state.tdeeHistory.push({ date, tdee: patch.tdee });
      if (patch.phaseOffsets !== undefined || patch.kcalPer1kSteps !== undefined) {
        const { phaseOffsets, kcalPer1kSteps } = state.settings;
        state.rateHistory.push({ date, phaseOffsets, kcalPer1kSteps });
      }
      break;
    }
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

let last = 0;

/** Now, but always after the last event stamped here, so a device's events replay in the order they were made. */
function nextTime(): Date {
  last = Math.max(Date.now(), last + 1);
  return new Date(last);
}

export function stamp(change: Change, dev: string, now = nextTime()): Event {
  return { ...change, id: newId(), t: now.toISOString(), dev } as Event;
}
