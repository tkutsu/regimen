import { describe, expect, it } from "vitest";
import { intake, missingStaples } from "./day";
import { deleteFood } from "./foodDeletion";
import { pickableFoods } from "./nutrition";
import { saveRecipe } from "./recipes";
import { applyEvents, fold, stamp, type State } from "./state";
import type { Change, Food, Recipe } from "./types";

const oats: Food = { id: "oats", name: "Oats", basis: "100g", group: "", fav: false, note: "", kcal: 400, prot: 10, sugar: 1 };
const porridge: Recipe = { id: "porridge", name: "Porridge", basis: "item", items: 1, ingredients: [{ foodId: oats.id, amount: 50 }], totalG: 0, containerG: 0, fav: false };
const today = "2026-11-07";
const setup: Change[] = [
  { type: "food.upsert", food: oats },
  { type: "recipe.upsert", recipe: porridge },
  { type: "entry.upsert", entry: { id: "past", date: "2026-11-06", foodId: porridge.id, amount: 1, done: true } },
  { type: "entry.upsert", entry: { id: "now", date: today, foodId: porridge.id, amount: 1, done: false } },
  { type: "settings", settings: { staples: [{ id: "s", foodId: porridge.id, amount: 1, from: "2026-11-01" }] } },
];
const state = fold(setup.map((change) => stamp(change, "desktop")));
const apply = (from: State, changes: Change[]) => applyEvents(from, changes.map((change) => stamp(change, "desktop")));
const more: Recipe = { ...porridge, ingredients: [{ foodId: oats.id, amount: 100 }] };

describe("saving a recipe", () => {
  it("keeps days before today as they were, while today, staples and the list follow the edit", () => {
    const next = apply(state, saveRecipe(state, more, [], today));
    expect(intake(next, "2026-11-06").kcal).toBe(200);
    expect(intake(next, today).kcal).toBe(400);
    expect(next.recipes.get(porridge.id)).toMatchObject({ archived: true, ingredients: [], values: { kcal: 200 } });

    const current = [...next.recipes.values()].filter((recipe) => !recipe.archived);
    expect(current).toEqual([{ ...more, id: current[0].id }]);
    expect(next.entries.get("now")?.foodId).toBe(current[0].id);
    expect(next.entries.get("past")?.foodId).toBe(porridge.id);
    expect(missingStaples(next, "2026-11-08").map((entry) => entry.foodId)).toEqual([current[0].id]);
    expect(pickableFoods(next).has(porridge.id)).toBe(false);
  });

  it("keeps the frozen days when an ingredient is later removed everywhere", () => {
    const edited = apply(state, saveRecipe(state, more, [], today));
    const next = apply(edited, deleteFood(edited, oats.id, true));
    expect(intake(next, "2026-11-06").kcal).toBe(200);
  });

  it("edits in place when nothing before today used it, or only the name or keywords changed", () => {
    const fresh = apply(state, [{ type: "entry.delete", entryId: "past" }]);
    expect(saveRecipe(fresh, more, [], today)).toEqual([{ type: "recipe.upsert", recipe: more }]);
    const renamed = { ...porridge, name: "Oat porridge" };
    expect(saveRecipe(state, renamed, [], today)).toEqual([{ type: "recipe.upsert", recipe: renamed }]);
    const tagged = { ...porridge, keywords: ["βρώμη"] };
    expect(saveRecipe(state, tagged, [], today)).toEqual([{ type: "recipe.upsert", recipe: tagged }]);
  });

  it("freezes the batch a new batch replaces", () => {
    const batch: Recipe = { ...more, id: "batch2" };
    const next = apply(state, saveRecipe(state, batch, [], today, porridge));
    expect(next.recipes.get(porridge.id)).toMatchObject({ archived: true, ingredients: [], values: { kcal: 200 } });
    expect(intake(next, today).kcal).toBe(200);
    expect(next.recipes.get(batch.id)).toEqual(batch);
  });
});
