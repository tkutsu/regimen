import { describe, expect, it } from "vitest";
import { dayOf, intake, shiftDate, targets, trendWeight } from "./day";
import { recipeAsFood } from "./nutrition";
import { fold, stamp } from "./state";
import type { Change, Food } from "./types";

const food = (id: string, basis: Food["basis"], kcal: number, prot = 0): Food => ({
  id,
  name: id,
  basis,
  group: "",
  fav: false,
  note: "",
  kcal,
  prot,
  fiber: 0,
  satFat: 0,
  unsatFat: 0,
  salt: 0,
});

const oats = food("oats", "100g", 374, 13);
const omega3 = food("omega3", "item", 10);

let clock = 0;
const state = (...changes: Change[]) =>
  fold(changes.map((change) => stamp(change, "desktop", new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)))));

describe("intake", () => {
  it("scales per-100g foods by grams and item foods by count", () => {
    const s = state(
      { type: "food.upsert", food: oats },
      { type: "food.upsert", food: omega3 },
      { type: "entry.upsert", entry: { id: "1", date: "2026-10-31", foodId: "oats", amount: 60, done: true } },
      { type: "entry.upsert", entry: { id: "2", date: "2026-10-31", foodId: "omega3", amount: 2, done: false } },
      { type: "entry.upsert", entry: { id: "3", date: "2026-10-30", foodId: "oats", amount: 500, done: true } },
    );
    expect(intake(s, "2026-10-31").kcal).toBeCloseTo(374 * 0.6 + 20);
  });
});

describe("recipeAsFood", () => {
  it("divides by the pot weight minus the container", () => {
    const foods = new Map([["oats", oats]]);
    const recipe = { id: "r", name: "r", ingredients: [{ foodId: "oats", amount: 200 }], totalG: 1500, containerG: 1000 };
    expect(recipeAsFood(recipe, foods).kcal).toBeCloseTo((374 * 2) / 5);
  });

  it("falls back to raw ingredient weight when the pot was not weighed", () => {
    const foods = new Map([["oats", oats]]);
    const recipe = { id: "r", name: "r", ingredients: [{ foodId: "oats", amount: 200 }], totalG: 0, containerG: 0 };
    expect(recipeAsFood(recipe, foods).kcal).toBeCloseTo(374);
  });
});

describe("targets", () => {
  it("adds the phase offset, steps and extra kcal to TDEE", () => {
    const s = state({ type: "day.upsert", day: { date: "2026-10-31", phase: "bulk", steps: 3000, extraKcal: 170 } });
    expect(targets(s, "2026-10-31").kcal).toBe(2300 + 100 + 3 * 37 + 170);
  });

  it("prefers a day's own offset over the phase default", () => {
    const s = state({ type: "day.upsert", day: { date: "2026-10-31", phase: "cut", steps: 0, extraKcal: 0, offset: -800 } });
    expect(targets(s, "2026-10-31").kcal).toBe(1500);
  });

  it("bases protein on the 7-day average weight", () => {
    const s = state(
      { type: "weight", date: "2026-10-24", kg: 99 },
      { type: "weight", date: "2026-10-30", kg: 68 },
      { type: "weight", date: "2026-10-31", kg: 70 },
    );
    expect(trendWeight(s, "2026-10-31")).toBe(69);
    expect(targets(s, "2026-10-31").prot).toBeCloseTo(69 * 1.6);
  });
});

describe("dayOf", () => {
  it("carries phase and offset forward but not steps", () => {
    const s = state({ type: "day.upsert", day: { date: "2026-10-29", phase: "cut", steps: 8000, extraKcal: 0, offset: -400 } });
    expect(dayOf(s, "2026-10-31")).toEqual({ date: "2026-10-31", phase: "cut", offset: -400, steps: 0, extraKcal: 0 });
  });
});

describe("shiftDate", () => {
  it("crosses month boundaries", () => {
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });
});
