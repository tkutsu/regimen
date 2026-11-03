import { describe, expect, it } from "vitest";
import { applyEvents, fold, parseLogs, stamp } from "./state";
import type { Event, Food, Settings } from "./types";

const oats: Food = {
  id: "oats",
  name: "oats",
  basis: "100g",
  group: "carbs",
  fav: true,
  note: "",
  kcal: 374,
  prot: 13,
  fiber: 9,
  satFat: 1.5,
  unsatFat: 5,
  salt: 0,
  sugar: 0,
};

const line = (o: object) => JSON.stringify(o);

describe("parseLogs", () => {
  it("merges device logs in time order and skips a half-synced line", () => {
    const desktop = [
      line({ id: "a", t: "2026-10-31T08:00:00Z", dev: "desktop", type: "weight", date: "2026-10-31", kg: 68 }),
      '{"id":"broken","t":',
    ].join("\n");
    const phone = line({ id: "b", t: "2026-10-31T07:00:00Z", dev: "phone", type: "weight", date: "2026-10-31", kg: 67.9 });

    expect(parseLogs([desktop, phone]).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("collapses Syncthing conflict copies by id", () => {
    const event = line({ id: "a", t: "2026-10-31T08:00:00Z", dev: "phone", type: "food.delete", foodId: "x" });
    expect(parseLogs([event, event])).toHaveLength(1);
  });

  it("reads the event written after a torn line", () => {
    const next = line({ type: "food.upsert", food: oats, id: "b", t: "2026-10-31T08:00:00Z", dev: "phone" });
    expect(parseLogs(['{"type":"weight","date":"2026-1' + next]).map((e) => e.id)).toEqual(["b"]);
  });

  it("keeps a device's events in the order they were stamped", () => {
    const events = Array.from({ length: 20 }, (_, kg) => stamp({ type: "weight", date: "2026-10-31", kg }, "phone"));
    expect(fold(parseLogs([events.map(line).join("\n")])).weights.get("2026-10-31")).toBe(19);
  });
});

describe("fold", () => {
  it("preserves daily rollover through log reloads and clearing", () => {
    const day = { date: "2026-10-31", phase: "cut" as const, steps: 3000, extraKcal: 100, rolloverKcal: 200 };
    const saved = stamp({ type: "day.upsert", day }, "desktop");
    const reloaded = fold(parseLogs([line(saved)]));
    expect(reloaded.days.get(day.date)).toEqual(day);
    for (const rolloverKcal of [0, -100]) {
      const changed = stamp({ type: "day.upsert", day: { ...day, rolloverKcal } }, "phone");
      const next = fold(parseLogs([[saved, changed].map(line).join("\n")]));
      expect(next.days.get(day.date)).toEqual({ ...day, rolloverKcal });
    }
  });

  it("keeps food keywords through the event log and subsequent edits", () => {
    const food = { ...oats, keywords: ["βρώμη", "porridge"] };
    const event = stamp({ type: "food.upsert", food }, "desktop");
    const state = fold(parseLogs([line(event)]));
    expect(state.foods.get(food.id)).toEqual(food);
    const next = applyEvents(state, [stamp({ type: "food.upsert", food: { ...food, name: "Rolled oats" } }, "phone")]);
    expect(next.foods.get(food.id)?.keywords).toEqual(food.keywords);
  });

  it("keeps the last write per entity", () => {
    const state = fold([
      stamp({ type: "food.upsert", food: oats }, "desktop", new Date("2026-10-30")),
      stamp({ type: "food.upsert", food: { ...oats, kcal: 380 } }, "phone", new Date("2026-10-31")),
      stamp({ type: "weight", date: "2026-10-31", kg: 68.1 }, "phone"),
      stamp({ type: "weight", date: "2026-10-31", kg: 68.0 }, "phone"),
    ]);
    expect(state.foods.get("oats")?.kcal).toBe(380);
    expect(state.weights.get("2026-10-31")).toBe(68.0);
  });

  it("merges partial settings over the defaults", () => {
    const state = fold([stamp({ type: "settings", settings: { tdee: 2100 } }, "desktop")]);
    expect(state.settings.tdee).toBe(2100);
    expect(state.settings.limits.prot).toEqual({ min: 1.6 });
  });

  it("reads protein and sugar settings written before limits had ranges", () => {
    const legacy = { proteinPerKg: 2, sugarPct: 8 } as Partial<Settings>;
    const state = fold([stamp({ type: "settings", settings: legacy }, "desktop")]);
    expect(state.settings.limits.prot).toEqual({ min: 2 });
    expect(state.settings.limits.sugar).toEqual({ max: 8 });
    expect(state.settings.limits.salt).toEqual({ max: 4.5 });
  });

  it("merges limits per nutrient, so two devices' edits both stay", () => {
    const state = fold([
      stamp({ type: "settings", settings: { limits: { prot: { min: 2 } } } }, "desktop"),
      stamp({ type: "settings", settings: { limits: { fiber: { min: 35 } } } }, "phone"),
    ]);
    expect(state.settings.limits).toMatchObject({ prot: { min: 2 }, fiber: { min: 35 }, salt: { max: 4.5 } });
  });

  it("skips an event missing its payload instead of failing the history", () => {
    const broken = { id: "x", t: "2026-10-31T08:00:00Z", dev: "phone", type: "food.upsert" } as Event;
    const state = fold([broken, stamp({ type: "food.upsert", food: oats }, "desktop")]);
    expect(state.foods.has("oats")).toBe(true);
  });

  it("applies new events to a copy, sharing what they don't change", () => {
    const state = fold([stamp({ type: "food.upsert", food: oats }, "desktop")]);
    const next = applyEvents(state, [stamp({ type: "weight", date: "2026-10-31", kg: 68 }, "desktop")]);
    expect(next.weights.get("2026-10-31")).toBe(68);
    expect(state.weights.size).toBe(0);
    expect(next.foods).toBe(state.foods);
  });

  it("removes deleted entities", () => {
    const state = fold([
      stamp({ type: "food.upsert", food: oats }, "desktop", new Date("2026-10-30")),
      stamp({ type: "food.delete", foodId: "oats" }, "desktop", new Date("2026-10-31")),
    ]);
    expect(state.foods.size).toBe(0);
  });
});
