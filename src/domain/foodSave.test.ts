import { describe, expect, it } from "vitest";
import { intake } from "./day";
import { saveFood } from "./foodSave";
import { applyEvents, fold, stamp, type State } from "./state";
import type { Change, Food, Recipe } from "./types";

const oats: Food = { id: "oats", name: "Oats", basis: "100g", group: "", fav: false, note: "", kcal: 400, prot: 10, sugar: 1 };
const milk: Food = { ...oats, id: "milk", name: "Milk", kcal: 50 };
const porridge: Recipe = { id: "porridge", name: "Porridge", basis: "item", items: 1, ingredients: [{ foodId: oats.id, amount: 50 }], totalG: 0, containerG: 0 };
const today = "2026-11-07";
const yesterday = "2026-11-06";
const setup: Change[] = [
  { type: "food.upsert", food: oats },
  { type: "food.upsert", food: milk },
  { type: "recipe.upsert", recipe: porridge },
  { type: "entry.upsert", entry: { id: "oats-past", date: yesterday, foodId: oats.id, amount: 100, done: true } },
  { type: "entry.upsert", entry: { id: "porridge-past", date: yesterday, foodId: porridge.id, amount: 1, done: true } },
  { type: "entry.upsert", entry: { id: "milk-past", date: yesterday, foodId: milk.id, amount: 100, done: true } },
  { type: "entry.upsert", entry: { id: "oats-now", date: today, foodId: oats.id, amount: 100, done: false } },
];
const state = fold(setup.map((change) => stamp(change, "desktop")));
const save = (from: State, food: Food) => applyEvents(from, saveFood(from, food, today).map((change) => stamp(change, "desktop")));

describe("saving a food", () => {
  it("keeps days before today, directly and through recipes, while today follows the edit", () => {
    const next = save(state, { ...oats, kcal: 300, sugar: undefined });
    expect(intake(next, yesterday)).toEqual(intake(state, yesterday));
    expect(intake(next, today).kcal).toBe(300);
    expect(intake(next, today).sugarIncomplete).toBe(true);
    expect(next.entries.get("milk-past")?.frozen).toBeUndefined();
  });

  it("keeps the first values through later edits and a change of basis", () => {
    const twice = save(save(state, { ...oats, kcal: 300 }), { ...oats, kcal: 200, basis: "item" });
    expect(intake(twice, yesterday)).toEqual(intake(state, yesterday));
    expect(twice.entries.get("oats-past")?.frozen).toEqual({ basis: "100g", kcal: 400, prot: 10, sugar: 1 });
  });

  it("writes only the food when nothing it counts by changed", () => {
    const renamed = { ...oats, name: "Rolled oats", fav: true };
    expect(saveFood(state, renamed, today)).toEqual([{ type: "food.upsert", food: renamed }]);
  });
});
