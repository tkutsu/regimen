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
