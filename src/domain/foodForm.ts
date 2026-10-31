import { NUTRIENTS } from "./nutrition";
import type { Food, Nutrients, Variant } from "./types";

type Key = keyof Nutrients;

/** A food being edited, numbers kept as typed so a blank (unknown) stays apart from 0. */
export type FoodForm = {
  name: string;
  group: string;
  basis: Food["basis"];
  fav: boolean;
  note: string;
  values: Record<Key, string>;
  variants: { name: string; factor: string }[];
};

const texts = (food?: Food) =>
  Object.fromEntries(NUTRIENTS.map((key) => [key, food?.[key] === undefined ? "" : String(food[key])])) as Record<Key, string>;

export function toForm(food?: Food): FoodForm {
  return {
    name: food?.name ?? "",
    group: food?.group ?? "",
    basis: food?.basis ?? "100g",
    fav: food?.fav ?? false,
    note: food?.note ?? "",
    values: texts(food),
    variants: (food?.variants ?? []).map((v) => ({ name: v.name, factor: String(v.factor) })),
  };
}

/** Blank reads as null (unknown), a number ≥ 0 as itself, anything else as NaN. */
export function readValue(text: string): number | null {
  if (!text.trim()) return null;
  const value = Number(text.trim().replace(",", "."));
  return value >= 0 ? value : NaN;
}

/** The edited food, or undefined while something is missing or not a number. */
export function fromForm(form: FoodForm, id: string): Food | undefined {
  const name = form.name.trim();
  const kcal = readValue(form.values.kcal);
  if (!name || kcal === null || Number.isNaN(kcal)) return undefined;

  const food: Food = { id, name, basis: form.basis, group: form.group.trim(), fav: form.fav, note: form.note.trim(), kcal };
  for (const key of NUTRIENTS.slice(1)) {
    const value = readValue(form.values[key]);
    if (Number.isNaN(value)) return undefined;
    if (value !== null) food[key] = value;
  }

  const variants = form.variants
    .filter((v) => v.name.trim() || v.factor.trim())
    .map((v) => ({ name: v.name.trim(), factor: readValue(v.factor) }));
  if (variants.some((v) => !v.name || !v.factor)) return undefined;
  if (variants.length) food.variants = variants as Variant[];
  return food;
}
