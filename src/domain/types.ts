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
  /** Alternate names and search terms, including translations. */
  keywords?: string[];
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
 * Either bound may be left out. Units: protein g per kg of trend weight, fiber and salt g,
 * fats and sugar % of kcal.
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
  /** Omitted in older recipes, which use per-100g values. */
  basis?: Food["basis"];
  /** Items made by the batch, for ingredient-based per-item recipes. */
  items?: number;
  /** Variant names and factors are copied in when selected. */
  ingredients: { foodId: string; amount: number; variant?: string; factor?: number }[];
  /** Weighed pot including the container; the difference is the cooked food. */
  totalG: number;
  containerG: number;
  /** Values in the selected basis, used while the recipe has no ingredients. */
  values?: Values;
  note?: string;
  /** An old batch: kept for the days that ate it, left out of the picker. */
  archived?: boolean;
  /** Recipes are favourites unless unstarred. */
  fav?: false;
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

/** Every exercise counts reps; `measure` is still written because older builds read it. */
export type Exercise = { id: string; name: string; measure: "reps" };

/** What one set records: reps, with kg (left out = bodyweight). */
export type Amount = { reps?: number; kg?: number };

/**
 * One planned line of a workout: 3 sets of 8 @ 60 kg. A linked line is in a superset with the
 * line above: the two are done back to back, with no rest between. A line with drops has that
 * many drop sets after its last set, each lighter than the one before and straight after it.
 */
export type Target = Amount & {
  exerciseId: string;
  sets: number;
  linked?: true;
  drops?: number;
  /** One drop, as saved before there could be more. */
  drop?: true;
};

/** A template, started whenever you like. */
export type Workout = { id: string; name: string; targets: Target[]; note?: string };

/** A set not ticked yet is still the plan. A drop set follows the set before it with no rest. */
export type SetLog = Amount & { exerciseId: string; done: boolean; drop?: true };

/**
 * One time a workout was done. Its sets are copied in when it starts and its name with them,
 * so editing or deleting the workout later leaves it alone. Finishing drops the sets not done.
 */
export type Session = {
  id: string;
  date: string;
  workoutId?: string;
  name: string;
  /** In order; an exercise's sets are shown together, where its first one is. */
  sets: SetLog[];
  /** Exercises in a superset with the exercise shown above them, as their workout lines were. */
  linked?: string[];
  finished?: boolean;
  note?: string;
};

/** A settings change: the fields it sets, and of limits only the nutrients it sets. */
export type SettingsPatch = Partial<Omit<Settings, "limits">> & { limits?: Partial<Settings["limits"]> };

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
    | { type: "settings"; settings: SettingsPatch }
    | { type: "exercise.upsert"; exercise: Exercise }
    | { type: "exercise.delete"; exerciseId: string }
    | { type: "workout.upsert"; workout: Workout }
    | { type: "workout.delete"; workoutId: string }
    | { type: "session.upsert"; session: Session }
    | { type: "session.delete"; sessionId: string }
  );

/** An event before it is stamped with id, time and device. */
export type Change = Event extends infer E ? (E extends Event ? Omit<E, keyof Meta> : never) : never;
