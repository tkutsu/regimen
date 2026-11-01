export type Phase = "bulk" | "maintain" | "cut";

export type Nutrients = {
  kcal: number;
  prot: number;
  fiber: number;
  satFat: number;
  unsatFat: number;
  salt: number;
  sugar: number;
};

/** Another state of the same food, e.g. raw pasta is the boiled values × 2.4. */
export type Variant = { name: string; factor: number };

/** Only kcal is always known; a missing nutrient means the source had no value for it. */
export type Values = Pick<Nutrients, "kcal"> & Partial<Nutrients>;

/** Nutrients are per 100 g, or per item when basis is "item". */
export type Food = Values & {
  id: string;
  name: string;
  basis: "100g" | "item";
  group: string;
  fav: boolean;
  note: string;
  variants?: Variant[];
};

/**
 * amount is grams, or a count for "item" foods. Planned entries have done = false.
 * A variant's factor is copied in, so later edits to the food leave history alone.
 */
export type Entry = {
  id: string;
  date: string;
  foodId: string;
  amount: number;
  done: boolean;
  variant?: string;
  factor?: number;
  /** The staple this entry was planned from. */
  staple?: string;
};

export type Container = { id: string; name: string; grams: number };

/** A food planned on every day from `from` on; a day it's removed from stays without it. */
export type Staple = { id: string; foodId: string; amount: number; variant?: string; factor?: number; from: string };

/** Nutrients with a settable range; kcal follows the phase instead. */
export type Limited = Exclude<keyof Nutrients, "kcal">;

/**
 * Either bound may be left out. Units: protein g per kg of trend weight, fiber g per
 * 1000 kcal, fats and sugar % of kcal, salt g.
 */
export type Range = { min?: number; max?: number };

export type Theme = "system" | "light" | "dark";

export type Day = {
  date: string;
  phase: Phase;
  steps: number;
  extraKcal: number;
  /** kcal offset from TDEE for this day; falls back to the phase's offset. */
  offset?: number;
};

export type Recipe = {
  id: string;
  name: string;
  ingredients: { foodId: string; amount: number }[];
  /** Weighed pot including the container; the difference is the cooked food. */
  totalG: number;
  containerG: number;
  /** Per 100 g, written by hand: what the recipe counts while it has no ingredients. */
  values?: Values;
  note?: string;
  /** An old batch: kept for the days that ate it, left out of the picker. */
  archived?: boolean;
};

export type Settings = {
  tdee: number;
  phaseOffsets: Record<Phase, number>;
  kcalPer1kSteps: number;
  limits: Record<Limited, Range>;
  containers: Container[];
  staples: Staple[];
  theme: Theme;
  /** Hue of the accent colour, 0-360 (oklch). */
  accentHue: number;
};

type Meta = { id: string; t: string; dev: string };

export type Event = Meta &
  (
    | { type: "food.upsert"; food: Food }
    | { type: "food.delete"; foodId: string }
    | { type: "entry.upsert"; entry: Entry }
    | { type: "entry.delete"; entryId: string }
    | { type: "day.upsert"; day: Day }
    | { type: "weight"; date: string; kg: number }
    | { type: "recipe.upsert"; recipe: Recipe }
    | { type: "recipe.delete"; recipeId: string }
    | { type: "settings"; settings: Partial<Settings> }
  );

/** An event before it is stamped with id, time and device. */
export type Change = Event extends infer E ? (E extends Event ? Omit<E, keyof Meta> : never) : never;
