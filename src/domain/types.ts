export type Phase = "bulk" | "maintain" | "cut";

export type Nutrients = {
  kcal: number;
  prot: number;
  fiber: number;
  satFat: number;
  unsatFat: number;
  salt: number;
};

/** Nutrients are per 100 g, or per item when basis is "item". */
export type Food = Nutrients & {
  id: string;
  name: string;
  basis: "100g" | "item";
  group: string;
  fav: boolean;
  note: string;
};

/** amount is grams, or a count for "item" foods. Planned entries have done = false. */
export type Entry = {
  id: string;
  date: string;
  foodId: string;
  amount: number;
  done: boolean;
};

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
};

export type Settings = {
  tdee: number;
  phaseOffsets: Record<Phase, number>;
  proteinPerKg: number;
  kcalPer1kSteps: number;
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
