import { describe, expect, it } from "vitest";
import { allFoods, parseAmount, scale, toggleFav } from "./nutrition";
import { fold, stamp, type State } from "./state";
import type { Change, Food, Recipe } from "./types";

describe("toggleFav", () => {
  let clock = 0;
  const state = (...changes: Change[]) => fold(changes.map((change) => stamp(change, "desktop", new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)))));
  const oats: Food = { id: "oats", name: "oats", basis: "100g", group: "", fav: false, note: "", kcal: 380 };
  const stew: Recipe = { id: "stew", name: "stew", ingredients: [], totalG: 0, containerG: 0, values: { kcal: 90 } };
  const favOf = (s: State, id: string) => allFoods(s).get(id)?.fav;

  it("stars and unstars a food", () => {
    const add: Change = { type: "food.upsert", food: oats };
    const starred = state(add, ...toggleFav(state(add), "oats"));
    expect(favOf(starred, "oats")).toBe(true);
    expect(toggleFav(starred, "oats")).toEqual([add]);
  });

  it("unstars a recipe, a favourite by default, and stars it back", () => {
    const add: Change = { type: "recipe.upsert", recipe: stew };
    expect(favOf(state(add), "stew")).toBe(true);
    const unstarred = state(add, ...toggleFav(state(add), "stew"));
    expect(favOf(unstarred, "stew")).toBe(false);
    expect(toggleFav(unstarred, "stew")).toEqual([add]);
  });

  it("leaves an unknown id alone", () => {
    expect(toggleFav(state(), "missing")).toEqual([]);
  });
});

describe("parseAmount", () => {
  it("replaces with a plain number", () => {
    expect(parseAmount("120", 80)).toBe(120);
    expect(parseAmount("12,5")).toBe(12.5);
  });

  it("adds or removes with a leading sign", () => {
    expect(parseAmount("+50", 100)).toBe(150);
    expect(parseAmount("-20", 100)).toBe(80);
    expect(parseAmount("-200", 100)).toBe(0);
  });

  it("sums a written-out calculation", () => {
    expect(parseAmount("120+30-10", 999)).toBe(140);
  });

  it("rejects anything else", () => {
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount("abc")).toBeUndefined();
    expect(parseAmount("1+")).toBeUndefined();
  });
});

describe("scale", () => {
  const pasta: Food = {
    id: "pasta",
    name: "pasta, boiled",
    basis: "100g",
    group: "",
    fav: false,
    note: "",
    kcal: 150,
    prot: 5,
    fiber: 1.25,
    satFat: 0.2,
    unsatFat: 0.8,
    salt: 0,
    sugar: 0,
    variants: [{ name: "raw", factor: 2.4 }],
  };

  it("applies a variant's factor", () => {
    expect(scale(pasta, 100, 2.4).kcal).toBeCloseTo(360);
    expect(scale(pasta, 100).kcal).toBe(150);
  });
});
