import type { Change, Day, Entry, Event, Food, Recipe, Settings } from "./types";

export type State = {
  foods: Map<string, Food>;
  entries: Map<string, Entry>;
  days: Map<string, Day>;
  weights: Map<string, number>;
  recipes: Map<string, Recipe>;
  settings: Settings;
};

export const defaultSettings: Settings = {
  tdee: 2300,
  phaseOffsets: { bulk: 100, maintain: 0, cut: -600 },
  proteinPerKg: 1.6,
  kcalPer1kSteps: 37,
  sugarPct: 10,
  containers: [],
};

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
    settings: defaultSettings,
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
    case "settings":
      state.settings = { ...state.settings, ...event.settings };
      break;
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function stamp(change: Change, dev: string, now = new Date()): Event {
  return { ...change, id: newId(), t: now.toISOString(), dev } as Event;
}
