import { describe, expect, it } from "vitest";
import { fold, parseLogs, stamp } from "./state";
import type { Food, Settings } from "./types";

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
});

describe("fold", () => {
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

  it("removes deleted entities", () => {
    const state = fold([
      stamp({ type: "food.upsert", food: oats }, "desktop", new Date("2026-10-30")),
      stamp({ type: "food.delete", foodId: "oats" }, "desktop", new Date("2026-10-31")),
    ]);
    expect(state.foods.size).toBe(0);
  });
});
