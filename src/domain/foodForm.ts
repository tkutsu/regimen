import { NUTRIENTS } from "./nutrition";
import type { Food, Nutrients, Values, Variant } from "./types";

type Key = keyof Nutrients;

/** A food being edited, numbers kept as typed so a blank (unknown) stays apart from 0. */
export type FoodForm = {
  name: string;
  group: string;
  basis: Food["basis"];
  fav: boolean;
  note: string;
  values: ValueTexts;
  variants: { name: string; factor: string }[];
};

/** Nutrients as typed; blank is unknown. */
export type ValueTexts = Record<Key, string>;

export const valueTexts = (values?: Partial<Values>) =>
  Object.fromEntries(NUTRIENTS.map((key) => [key, values?.[key] === undefined ? "" : String(values[key])])) as ValueTexts;

export function toForm(food?: Food): FoodForm {
  return {
    name: food?.name ?? "",
    group: food?.group ?? "",
    basis: food?.basis ?? "100g",
    fav: food?.fav ?? false,
    note: food?.note ?? "",
    values: valueTexts(food),
    variants: (food?.variants ?? []).map((v) => ({ name: v.name, factor: String(v.factor) })),
  };
}

/** Blank reads as null (unknown), a number ≥ 0 as itself, anything else as NaN. */
export function readValue(text: string): number | null {
  if (!text.trim()) return null;
  const value = Number(text.trim().replace(",", "."));
  return value >= 0 ? value : NaN;
}

/** The typed nutrients, or undefined while kcal is blank or something isn't a number. */
export function readValues(texts: ValueTexts): Values | undefined {
  const kcal = readValue(texts.kcal);
  if (kcal === null || Number.isNaN(kcal)) return undefined;
  const values: Values = { kcal };
  for (const key of NUTRIENTS.slice(1)) {
    const value = readValue(texts[key]);
    if (Number.isNaN(value)) return undefined;
    if (value !== null) values[key] = value;
  }
  return values;
}

/** The edited food, or undefined while something is missing or not a number. */
export function fromForm(form: FoodForm, id: string): Food | undefined {
  const name = form.name.trim();
  const values = readValues(form.values);
  if (!name || !values) return undefined;

  const food: Food = { id, name, basis: form.basis, group: form.group.trim(), fav: form.fav, note: form.note.trim(), ...values };

  const variants = form.variants
    .filter((v) => v.name.trim() || v.factor.trim())
    .map((v) => ({ name: v.name.trim(), factor: readValue(v.factor) }));
  if (variants.some((v) => !v.name || !v.factor)) return undefined;
  if (variants.length) food.variants = variants as Variant[];
  return food;
}
