import { describe, expect, it } from "vitest";
import { dayOf, intake, missingStaples, shiftDate, targets, trendWeight } from "./day";
import { recipeAsFood } from "./nutrition";
import { defaultSettings, fold, stamp } from "./state";
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
  sugar: 0,
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

  it("flags missing sugar in eaten and planned food separately, keeping the known subtotal", () => {
    const s = state(
      { type: "food.upsert", food: { ...oats, sugar: 2 } },
      { type: "food.upsert", food: { ...omega3, sugar: undefined } },
      { type: "entry.upsert", entry: { id: "1", date: "2026-10-31", foodId: "oats", amount: 50, factor: 2, done: true } },
      { type: "entry.upsert", entry: { id: "2", date: "2026-10-31", foodId: "omega3", amount: 1, done: false } },
    );
    expect(intake(s, "2026-10-31", true)).toMatchObject({ sugar: 2, sugarIncomplete: false });
    expect(intake(s, "2026-10-31", false)).toMatchObject({ sugar: 0, sugarIncomplete: true });
    expect(intake(s, "2026-10-31")).toMatchObject({ sugar: 2, sugarIncomplete: true });
    expect(intake(s, "2026-10-30").sugarIncomplete).toBe(false);
    s.foods.set("omega3", omega3);
    expect(intake(s, "2026-10-31").sugarIncomplete).toBe(false);
  });

  it("flags missing foods, but ignores zero amounts and zero factors", () => {
    const s = state({ type: "entry.upsert", entry: { id: "1", date: "2026-10-31", foodId: "gone", amount: 1, done: true } });
    expect(intake(s, "2026-10-31").sugarIncomplete).toBe(true);
    s.entries.get("1")!.amount = 0;
    expect(intake(s, "2026-10-31").sugarIncomplete).toBe(false);
    s.entries.get("1")!.amount = 1;
    s.entries.get("1")!.factor = 0;
    expect(intake(s, "2026-10-31").sugarIncomplete).toBe(false);
  });

  it("flags a recipe whose ingredients lack sugar", () => {
    const s = state(
      { type: "food.upsert", food: { ...oats, sugar: undefined } },
      { type: "recipe.upsert", recipe: { id: "r", name: "porridge", ingredients: [{ foodId: "oats", amount: 60 }], totalG: 200, containerG: 0 } },
      { type: "entry.upsert", entry: { id: "1", date: "2026-10-31", foodId: "r", amount: 100, done: true } },
    );
    expect(intake(s, "2026-10-31").sugarIncomplete).toBe(true);
    s.foods.set("oats", { ...oats, sugar: 2 });
    expect(intake(s, "2026-10-31")).toMatchObject({ sugar: 0.6, sugarIncomplete: false });
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

  it("keeps past days on the maintenance set at the time", () => {
    const at = (date: string, tdee: number) => stamp({ type: "settings", settings: { tdee } }, "desktop", new Date(`${date}T12:00:00`));
    const s = fold([at("2026-10-10", 2200), at("2026-10-20", 2400)]);
    const maintain = (date: string) => targets(s, date).kcal;
    expect([maintain("2026-10-01"), maintain("2026-10-15"), maintain("2026-10-20"), maintain("2026-10-31")]).toEqual([2200, 2200, 2400, 2400]);
  });

  it("bases protein on the 7-day average weight", () => {
    const s = state(
      { type: "weight", date: "2026-10-24", kg: 99 },
      { type: "weight", date: "2026-10-30", kg: 68 },
      { type: "weight", date: "2026-10-31", kg: 70 },
    );
    expect(trendWeight(s, "2026-10-31")).toBe(69);
    expect(targets(s, "2026-10-31").prot.min).toBeCloseTo(69 * 1.6);
  });

  it("turns shares of kcal into grams and keeps unset bounds unset", () => {
    const s = state(
      { type: "day.upsert", day: { date: "2026-10-31", phase: "maintain", steps: 0, extraKcal: 0, offset: 0 } },
      { type: "settings", settings: { tdee: 1800, limits: { ...defaultSettings.limits, satFat: { min: 5, max: 10 } } } },
    );
    expect(targets(s, "2026-10-31").satFat).toEqual({ min: 10, max: 20 });
    expect(targets(s, "2026-10-31").salt).toEqual({ min: undefined, max: 4.5 });
  });
});

describe("missingStaples", () => {
  const staple = { id: "s1", foodId: "oats", amount: 60, from: "2026-10-30" };
  const settings: Change = { type: "settings", settings: { staples: [staple] } };

  it("plans staples from the day they were added", () => {
    const s = state(settings);
    expect(missingStaples(s, "2026-10-29")).toEqual([]);
    expect(missingStaples(s, "2026-10-31")).toMatchObject([{ id: "s1@2026-10-31", foodId: "oats", amount: 60, done: false, staple: "s1" }]);
  });

  it("leaves out staples already planned or removed from the day", () => {
    const s = state(settings, { type: "entry.delete", entryId: "s1@2026-10-31" });
    expect(missingStaples(s, "2026-10-31")).toEqual([]);
    s.entries.set("s1@2026-11-01", { ...missingStaples(s, "2026-11-01")[0] });
    expect(missingStaples(s, "2026-11-01")).toEqual([]);
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
