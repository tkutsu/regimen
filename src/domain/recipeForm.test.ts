import { describe, expect, it } from "vitest";
import { recipeAsFood, recipeTotals } from "./nutrition";
import { fromRecipeForm, newBatch, toRecipeForm } from "./recipeForm";
import type { Food, Recipe } from "./types";

const food = (id: string, kcal: number, basis: Food["basis"] = "100g"): Food => ({ id, name: id, basis, group: "", fav: false, note: "", kcal, prot: 10 });
const foods = new Map([food("rice", 350), food("oil", 900), food("egg", 70, "item")].map((f) => [f.id, f]));
const recipe: Recipe = { id: "r", name: "rice", ingredients: [{ foodId: "rice", amount: 300 }, { foodId: "oil", amount: 20 }, { foodId: "egg", amount: 2 }], totalG: 1300, containerG: 500 };

describe("recipe values", () => {
  it("divides the batch by the pot minus its container", () => {
    const { total, rawG, cookedG } = recipeTotals(recipe, foods);
    expect([total.kcal, rawG, cookedG]).toEqual([1050 + 180 + 140, 320, 800]);
    expect(recipeAsFood(recipe, foods).kcal).toBeCloseTo((1370 / 800) * 100);
  });

  it("falls back to the raw weight before it is weighed", () => {
    expect(recipeTotals({ ...recipe, totalG: 0 }, foods).cookedG).toBe(320);
  });

  it("scales variant nutrients without scaling ingredient or cooked weights", () => {
    const pasta: Food = { ...food("pasta", 150), prot: 5, fiber: 2, satFat: 0.5, unsatFat: 1, salt: 0.1, sugar: 3 };
    const variantFoods = new Map([...foods, [pasta.id, pasta] as const]);
    const batch: Recipe = { ...recipe, ingredients: [{ foodId: "pasta", amount: 200, variant: "raw", factor: 2.4 }], totalG: 1000 };
    const { total, rawG, cookedG } = recipeTotals(batch, variantFoods);
    expect([rawG, cookedG]).toEqual([200, 500]);
    const expected = { kcal: 720, prot: 24, fiber: 9.6, satFat: 2.4, unsatFat: 4.8, salt: 0.48, sugar: 14.4 };
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      expect(total[key]).toBeCloseTo(expected[key]);
      expect(recipeAsFood(batch, variantFoods)[key]).toBeCloseTo(expected[key] / 5);
    }
    const unweighed = recipeTotals({ ...batch, totalG: 0 }, variantFoods);
    expect(unweighed.cookedG).toBe(200);
    expect(unweighed.total.kcal).toBeCloseTo(720);
    variantFoods.set("pasta", { ...pasta, sugar: undefined });
    expect(recipeAsFood(batch, variantFoods).sugar).toBeUndefined();
  });

  it("applies variants to item ingredients alongside unmodified ingredients", () => {
    const batch: Recipe = { ...recipe, ingredients: [{ foodId: "egg", amount: 2, variant: "large", factor: 1.5 }, { foodId: "oil", amount: 20 }] };
    const { total, rawG, cookedG } = recipeTotals(batch, foods);
    expect(total.kcal).toBeCloseTo(210 + 180);
    expect([rawG, cookedG]).toEqual([20, 800]);
  });

  it("keeps sugar unknown until every contributing ingredient has a value", () => {
    const known = new Map<string, Food>([...foods].map(([id, food]) => [id, { ...food, sugar: 2 }]));
    expect(recipeAsFood(recipe, known).sugar).toBeCloseTo(1.3);
    known.set("rice", { ...known.get("rice")!, sugar: undefined });
    expect(recipeAsFood(recipe, known).sugar).toBeUndefined();
    expect(recipeAsFood({ ...recipe, ingredients: recipe.ingredients.filter((i) => i.foodId !== "rice") }, known).sugar).toBeDefined();
    expect(recipeAsFood({ ...recipe, ingredients: recipe.ingredients.map((i) => i.foodId === "rice" ? { ...i, amount: 0 } : i) }, known).sugar).toBeDefined();
    known.delete("rice");
    expect(recipeAsFood(recipe, known).sugar).toBeUndefined();
  });

  it("uses the values written by hand while it has no ingredients", () => {
    const byHand: Recipe = { ...recipe, ingredients: [], values: { kcal: 245, prot: 12 }, note: "350 g a slice" };
    const food = recipeAsFood(byHand, foods);
    expect([food.kcal, food.prot, food.sugar, food.note]).toEqual([245, 12, undefined, "350 g a slice"]);
    expect(recipeAsFood({ ...byHand, ingredients: recipe.ingredients }, foods).kcal).toBeCloseTo((1370 / 800) * 100);
  });

  it("stops listing an old batch as a favourite", () => {
    expect(recipeAsFood({ ...recipe, archived: true }, foods).fav).toBe(false);
  });
});

describe("recipe form", () => {
  it("round-trips a recipe and reads sums in amounts", () => {
    const form = toRecipeForm(recipe);
    expect(fromRecipeForm(form, "r", foods)).toEqual(recipe);
    expect(fromRecipeForm({ ...form, ingredients: [{ foodId: "rice", amount: "250+50" }] }, "r", foods)?.ingredients).toEqual([{ foodId: "rice", amount: 300 }]);
  });

  it("saves calculated gram amounts as numbers", () => {
    const form = {
      ...toRecipeForm(recipe),
      ingredients: [{ foodId: "rice", amount: "2.5*243/2" }],
      totalG: "500+400*2",
    };
    const saved = fromRecipeForm(form, "r", foods)!;
    expect(saved.ingredients).toEqual([{ foodId: "rice", amount: 303.75 }]);
    expect(saved.totalG).toBe(1300);
    expect(fromRecipeForm(toRecipeForm(saved), "r", foods)).toEqual(saved);
    expect(fromRecipeForm({ ...form, totalG: "1300/0" }, "r", foods)).toBeUndefined();
    expect(fromRecipeForm({ ...form, ingredients: [{ foodId: "rice", amount: "243/0" }] }, "r", foods)).toBeUndefined();
  });

  it("preserves selected variants through edits, reopening and new batches", () => {
    const batch: Recipe = { ...recipe, ingredients: [{ foodId: "rice", amount: 300, variant: "raw", factor: 2.4 }] };
    const changedFoods = new Map(foods);
    changedFoods.set("rice", { ...foods.get("rice")!, variants: [{ name: "raw", factor: 3 }] });
    const form = toRecipeForm(batch);
    const saved = fromRecipeForm(form, "r", changedFoods)!;
    expect(saved).toEqual(batch);
    const edited = fromRecipeForm({ ...form, ingredients: [{ ...form.ingredients[0], amount: "250+100" }] }, "r", changedFoods)!;
    expect(edited.ingredients).toEqual([{ foodId: "rice", amount: 350, variant: "raw", factor: 2.4 }]);
    const next = newBatch(edited, "r2");
    expect(next.totalG).toBe(0);
    expect(fromRecipeForm(toRecipeForm(next), "r2", foods)).toEqual(next);
    expect(recipeTotals(saved, changedFoods).total.kcal).toBeCloseTo(2520);
  });

  it("needs a name, ingredients with amounts, and a pot heavier than its container", () => {
    const form = toRecipeForm(recipe);
    expect(fromRecipeForm({ ...form, name: " " }, "r", foods)).toBeUndefined();
    expect(fromRecipeForm({ ...form, ingredients: [] }, "r", foods)).toBeUndefined();
    expect(fromRecipeForm({ ...form, ingredients: [{ foodId: "rice", amount: "" }] }, "r", foods)).toBeUndefined();
    expect(fromRecipeForm({ ...form, totalG: "400" }, "r", foods)).toBeUndefined();
    expect(fromRecipeForm({ ...form, totalG: "" }, "r", foods)?.totalG).toBe(0);
  });

  it("saves values by hand without ingredients, and drops them once it has some", () => {
    const form = { ...toRecipeForm(recipe), ingredients: [], totalG: "", values: { ...toRecipeForm().values, kcal: "245", sugar: "3,6" }, note: " thin " };
    expect(fromRecipeForm(form, "r", foods)).toEqual({ id: "r", name: "rice", ingredients: [], totalG: 0, containerG: 500, values: { kcal: 245, sugar: 3.6 }, note: "thin" });
    expect(fromRecipeForm({ ...form, values: toRecipeForm().values }, "r", foods)).toBeUndefined();
    expect(fromRecipeForm({ ...form, ingredients: [{ foodId: "rice", amount: "300" }] }, "r", foods)?.values).toBeUndefined();
  });

  it("needs a weighing when no ingredient is counted in grams", () => {
    const eggs = { ...toRecipeForm(recipe), ingredients: [{ foodId: "egg", amount: "4" }] };
    expect(fromRecipeForm({ ...eggs, totalG: "" }, "r", foods)).toBeUndefined();
    expect(fromRecipeForm({ ...eggs, totalG: "700" }, "r", foods)?.totalG).toBe(700);
  });

  it("starts a new batch unweighed", () => {
    expect(newBatch({ ...recipe, archived: true }, "r2")).toEqual({ ...recipe, id: "r2", totalG: 0, archived: undefined });
  });
});
