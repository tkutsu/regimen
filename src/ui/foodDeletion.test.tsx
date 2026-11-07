import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { intake, missingStaples } from "../domain/day";
import { deleteFood } from "../domain/foodDeletion";
import { deleteRecipe } from "../domain/recipes";
import { allFoods, pickableFoods, recipeAsFood, usedName } from "../domain/nutrition";
import { applyEvents, fold, parseLogs, stamp } from "../domain/state";
import type { Change, Food, Recipe } from "../domain/types";
import { FoodEditor } from "./FoodEditor";
import { FoodPicker } from "./FoodPicker";
import { Foods } from "./Foods";
import { RecipeEditor } from "./RecipeEditor";

vi.mock("./Dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useBack: () => {},
}));

const oats: Food = {
  id: "oats", name: "Rolled oats", basis: "100g", group: "cereals", fav: true, note: "",
  kcal: 380, prot: 13, sugar: 0, variants: [{ name: "cooked", factor: 0.5 }],
};
const rice: Food = { ...oats, id: "rice", name: "Rice", variants: undefined };
const recipe: Recipe = {
  id: "porridge", name: "Porridge", totalG: 300, containerG: 0,
  ingredients: [
    { foodId: oats.id, amount: 50 },
    { foodId: oats.id, amount: 100, variant: "cooked", factor: 0.5 },
  ],
};
const changes: Change[] = [
  { type: "food.upsert", food: oats },
  { type: "food.upsert", food: rice },
  { type: "recipe.upsert", recipe },
  { type: "entry.upsert", entry: { id: "e1", date: "2026-11-01", foodId: oats.id, amount: 50, done: true } },
  { type: "entry.upsert", entry: { id: "e2", date: "2026-11-01", foodId: oats.id, amount: 100, done: false, variant: "cooked", factor: 0.5 } },
  { type: "entry.upsert", entry: { id: "e3", date: "2026-11-02", foodId: recipe.id, amount: 150, done: true } },
  { type: "settings", settings: { staples: [
    { id: "s1", foodId: oats.id, amount: 50, from: "2026-11-01" },
    { id: "s2", foodId: oats.id, amount: 100, variant: "cooked", factor: 0.5, from: "2026-11-01" },
  ] } },
];
const events = changes.map((change) => stamp(change, "desktop"));
const state = fold(events);
const deletion = stamp(deleteFood(state, oats.id)[0], "desktop");
const deleted = applyEvents(state, [deletion]);

describe("deleting a recipe", () => {
  const removals = deleteRecipe(state, recipe.id).map((change) => stamp(change, "desktop"));
  const next = applyEvents(state, removals);

  it("leaves a marked placeholder with the same values, even if an ingredient later goes", () => {
    const food = allFoods(next).get(recipe.id);
    expect(usedName(food)).toBe("Porridge (deleted)");
    expect(usedName(allFoods(state).get(recipe.id))).toBe("Porridge");
    expect(intake(next, "2026-11-02")).toEqual(intake(state, "2026-11-02"));
    expect(next.entries.get("e3")).toEqual(state.entries.get("e3"));

    const later = applyEvents(next, deleteFood(next, oats.id, true).map((change) => stamp(change, "desktop")));
    expect(intake(later, "2026-11-02")).toEqual(intake(state, "2026-11-02"));
  });

  it("hides the placeholder from the recipe list and pickers", () => {
    expect(renderToStaticMarkup(<Foods state={next} commit={async () => true} />)).not.toContain(recipe.name);
    expect(pickableFoods(next).has(recipe.id)).toBe(false);
  });

  it("removes a recipe nothing uses, and marks no old batch as deleted", () => {
    const unused: Recipe = { ...recipe, id: "unused" };
    const before = applyEvents(state, [stamp({ type: "recipe.upsert", recipe: unused }, "desktop")]);
    expect(deleteRecipe(before, unused.id)).toEqual([{ type: "recipe.delete", recipeId: unused.id }]);
    expect(usedName(recipeAsFood({ ...recipe, archived: true }, state.foods))).toBe("Porridge");
  });

  it("offers deletion when the recipe is used", () => {
    const html = renderToStaticMarkup(<RecipeEditor recipe={recipe} saved foods={state.foods} recentIds={[]} containers={[]} uses={2}
      onSave={() => {}} onNewBatch={() => {}} onDelete={() => {}} onToggleFav={() => {}} onClose={() => {}} />);
    expect(html).toContain(">Delete recipe</button>");
  });
});

describe("deleting a used food", () => {
  it("preserves repeated uses, names, nutrition and staple planning after saving and reloading", () => {
    const reloaded = fold(parseLogs([[...events, deletion].map((event) => JSON.stringify(event)).join("\n")]));
    for (const next of [deleted, reloaded]) {
      expect(next.foods.get(oats.id)).toEqual({ ...oats, archived: true });
      expect(next.entries).toEqual(state.entries);
      expect(next.recipes).toEqual(state.recipes);
      expect(next.settings.staples).toEqual(state.settings.staples);
      expect(allFoods(next).get(oats.id)?.name).toBe(oats.name);
      expect(intake(next, "2026-11-01")).toEqual(intake(state, "2026-11-01"));
      expect(intake(next, "2026-11-01").kcal).toBe(380);
      expect(intake(next, "2026-11-02")).toEqual(intake(state, "2026-11-02"));
      expect(intake(next, "2026-11-02").kcal).toBe(190);
      expect(recipeAsFood(recipe, next.foods)).toEqual(recipeAsFood(recipe, state.foods));
      expect(missingStaples(next, "2026-11-03")).toEqual(missingStaples(state, "2026-11-03"));
    }
    expect(state.foods.get(oats.id)).toEqual(oats);
  });

  it("offers deletion even when the food is used more than once", () => {
    const html = renderToStaticMarkup(<FoodEditor food={oats} groups={[]} uses={6} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />);
    expect(html).toContain(">Delete food</button>");
    expect(html).toContain("Deleting it keeps existing logs, recipes and staples.");
    expect(html).toContain("Remove from everywhere");
    expect(html).not.toContain("can't be deleted");
  });

  it("removes every direct use and updates recipe totals, including old batches, after reloading", () => {
    const mixed: Recipe = {
      ...recipe, id: "mixed", name: "Mixed batch", archived: true, fav: false, note: "Keep this note",
      ingredients: [...recipe.ingredients, { foodId: rice.id, amount: 20 }],
    };
    const otherChanges: Change[] = [
      { type: "recipe.upsert", recipe: mixed },
      { type: "entry.upsert", entry: { id: "rice-entry", date: "2026-11-01", foodId: rice.id, amount: 20, done: true } },
      { type: "entry.upsert", entry: { id: "s1@2026-11-02", date: "2026-11-02", foodId: oats.id, amount: 50, done: false, staple: "s1" } },
      { type: "settings", settings: { staples: [...state.settings.staples, { id: "rice-staple", foodId: rice.id, amount: 20, from: "2026-11-01" }] } },
    ];
    const beforeEvents = [...events, ...otherChanges.map((change) => stamp(change, "desktop"))];
    const before = fold(beforeEvents);
    const removals = deleteFood(before, oats.id, true).map((change) => stamp(change, "desktop"));
    const reloaded = fold(parseLogs([[...beforeEvents, ...removals].map((event) => JSON.stringify(event)).join("\n")]));
    for (const next of [applyEvents(before, removals), reloaded]) {
      expect(next.foods.has(oats.id)).toBe(false);
      expect(next.foods.get(rice.id)).toEqual(rice);
      expect([...next.entries.values()].some((entry) => entry.foodId === oats.id)).toBe(false);
      expect(next.entries.get("rice-entry")).toEqual(before.entries.get("rice-entry"));
      expect(next.entries.get("e3")).toEqual(before.entries.get("e3"));
      expect(next.removed).toEqual(new Set(["e1", "e2", "s1@2026-11-02"]));
      expect(next.recipes.get(recipe.id)?.ingredients).toEqual([]);
      expect(next.recipes.get(mixed.id)).toEqual({ ...mixed, ingredients: [{ foodId: rice.id, amount: 20 }] });
      expect(next.settings).toEqual({ ...before.settings, staples: [before.settings.staples[2]] });
      expect(missingStaples(next, "2026-11-03").map((entry) => entry.foodId)).toEqual([rice.id]);
      expect(intake(next, "2026-11-01").kcal).toBe(76);
      expect(intake(next, "2026-11-02").kcal).toBe(0);
    }
    expect(before.entries.has("e1")).toBe(true);
    expect(before.recipes.get(recipe.id)).toEqual(recipe);
    expect(before.settings.staples).toHaveLength(3);
  });

  it("does not restore old handwritten nutrients when the last ingredient is removed", () => {
    const before = applyEvents(state, [stamp({ type: "recipe.upsert", recipe: { ...recipe, values: { kcal: 900 } } }, "desktop")]);
    const next = applyEvents(before, deleteFood(before, oats.id, true).map((change) => stamp(change, "desktop")));
    expect(recipeAsFood(next.recipes.get(recipe.id)!, next.foods).kcal).toBe(0);
  });

  it("can remove an archived food everywhere and leaves an unknown food alone", () => {
    const next = applyEvents(deleted, deleteFood(deleted, oats.id, true).map((change) => stamp(change, "desktop")));
    expect(next.foods.has(oats.id)).toBe(false);
    expect([...next.entries.values()].some((entry) => entry.foodId === oats.id)).toBe(false);
    expect(deleteFood(state, "unknown", true)).toEqual([]);
  });

  it("hides the food from the food list while retaining recipes that use it", () => {
    const html = renderToStaticMarkup(<Foods state={deleted} commit={async () => true} />);
    expect(html).not.toContain(oats.name);
    expect(html).toContain(rice.name);
    expect(html).toContain(recipe.name);
    expect(html).toContain("Search 1 foods");
  });

  it.each([true, false])("hides deleted favourites and recent foods in every picker (favourite: %s)", (fav) => {
    const next = applyEvents(deleted, [stamp({ type: "food.upsert", food: { ...oats, fav, archived: true } }, "desktop")]);
    // Recipes pass the food map directly; Today and staples pass pickableFoods.
    for (const foods of [next.foods, pickableFoods(next)]) {
      const html = renderToStaticMarkup(<FoodPicker foods={foods} recentIds={[oats.id, rice.id]} containers={[]} onAdd={() => {}} onToggleFav={() => {}} onClose={() => {}} />);
      expect(html).not.toContain(oats.name);
      expect(html).toContain(rice.name);
    }
  });
});
