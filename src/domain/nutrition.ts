import type { State } from "./state";
import type { Change, Food, Nutrients, Recipe, Values } from "./types";

export const NUTRIENTS = ["kcal", "prot", "fiber", "satFat", "unsatFat", "salt", "sugar"] as const;

export const LABELS: Record<keyof Nutrients, string> = {
  kcal: "kcal",
  prot: "protein",
  fiber: "fiber",
  satFat: "sat. fat",
  unsatFat: "unsat. fat",
  salt: "salt",
  sugar: "sugar",
};

/** Nutrients the food's source had no value for. */
export const unknownNutrients = (food: Food) => NUTRIENTS.filter((key) => food[key] === undefined);

export const zero = (): Nutrients => ({ kcal: 0, prot: 0, fiber: 0, satFat: 0, unsatFat: 0, salt: 0, sugar: 0 });

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const sum = zero();
  for (const key of NUTRIENTS) sum[key] = a[key] + b[key];
  return sum;
}

/**
 * Nutrients in an amount of food: grams for "100g" foods, a count for "item" foods.
 * Missing values contribute nothing to the known subtotal; callers must flag incomplete totals.
 */
export function scale(food: Food, amount: number, variantFactor = 1): Nutrients {
  const factor = (food.basis === "item" ? amount : amount / 100) * variantFactor;
  const out = zero();
  for (const key of NUTRIENTS) out[key] = (food[key] ?? 0) * factor;
  return out;
}

/**
 * What a batch adds up to. The cooked weight is the weighed pot minus its container;
 * without a weighing it falls back to the weight of the ingredients counted in grams.
 * Variant factors scale nutrients, leaving the ingredient weights unchanged.
 */
export function recipeTotals(recipe: Recipe, foods: Map<string, Food>) {
  let total = zero();
  let rawG = 0;
  for (const { foodId, amount, factor } of recipe.ingredients) {
    const food = foods.get(foodId);
    if (!food) continue;
    total = add(total, scale(food, amount, factor));
    if (food.basis === "100g") rawG += amount;
  }
  const cookedG = recipe.totalG - recipe.containerG;
  return { total, rawG, cookedG: cookedG > 0 ? cookedG : rawG, weighed: cookedG > 0 };
}

/** Per 100 g: the ingredients' sum, or the values written by hand while there are none. */
function recipeValues(recipe: Recipe, foods: Map<string, Food>): Values {
  if (!recipe.ingredients.length && recipe.values) return recipe.values;
  const { total, cookedG } = recipeTotals(recipe, foods);
  const per100 = zero();
  for (const key of NUTRIENTS) per100[key] = cookedG ? (total[key] / cookedG) * 100 : 0;
  const values: Values = per100;
  if (!cookedG || recipe.ingredients.some(({ foodId, amount }) => amount > 0 && foods.get(foodId)?.sugar === undefined)) delete values.sugar;
  return values;
}

/** A recipe as a per-100g food; old batches stop being favourites. */
export function recipeAsFood(recipe: Recipe, foods: Map<string, Food>): Food {
  const values = recipeValues(recipe, foods);
  const fav = !recipe.archived && recipe.fav !== false;
  return { ...values, id: recipe.id, name: recipe.name, basis: "100g", group: "recipes", fav, note: recipe.note ?? "" };
}

/** Stars or unstars one of your foods or recipes. */
export function toggleFav(state: State, id: string): Change[] {
  const recipe = state.recipes.get(id);
  if (recipe) {
    const { fav, ...rest } = recipe;
    return [{ type: "recipe.upsert", recipe: fav === false ? rest : { ...rest, fav: false } }];
  }
  const food = state.foods.get(id);
  return food ? [{ type: "food.upsert", food: { ...food, fav: !food.fav } }] : [];
}

/** Foods plus recipes, which can be eaten like any other food. */
export function allFoods(state: State): Map<string, Food> {
  const foods = new Map(state.foods);
  for (const recipe of state.recipes.values()) foods.set(recipe.id, recipeAsFood(recipe, state.foods));
  return foods;
}

/** Foods that can be added to a day: all but replaced recipe batches. */
export function pickableFoods(state: State): Map<string, Food> {
  const foods = allFoods(state);
  for (const recipe of state.recipes.values()) if (recipe.archived) foods.delete(recipe.id);
  return foods;
}

/**
 * Reads an amount the way a calculator would: "120", "120+30-10". A leading sign
 * adjusts the current amount instead of replacing it: "+50" adds, "-20" removes.
 */
export function parseAmount(text: string, current = 0): number | undefined {
  const s = text.replace(/,/g, ".").replace(/\s+/g, "");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([+-](\d+\.?\d*|\.\d+))*$/.test(s)) return undefined;
  const sum = s.match(/[+-]?(\d+\.?\d*|\.\d+)/g)!.reduce((total, term) => total + Number(term), 0);
  if (!Number.isFinite(sum)) return undefined;
  return Math.max(0, /^[+-]/.test(s) ? current + sum : sum);
}
