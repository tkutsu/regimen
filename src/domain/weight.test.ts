import { describe, expect, it } from "vitest";
import { shiftDate } from "./day";
import { fold, stamp } from "./state";
import type { Change, Food } from "./types";
import { estimateMaintenance, KCAL_PER_KG, weightSeries } from "./weight";

const END = "2026-10-31";
const meal: Food = { id: "meal", name: "meal", basis: "item", group: "", fav: false, note: "", kcal: 2000 };

let clock = 0;
const state = (...changes: Change[]) =>
  fold(changes.map((change) => stamp(change, "desktop", new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)))));

/** Daily weigh-ins over the last `days` days, falling by `kgPerDay`. */
const weighIns = (days: number, kgPerDay: number): Change[] =>
  Array.from({ length: days }, (_, i) => ({
    type: "weight",
    date: shiftDate(END, i - days + 1),
    kg: 80 + (i - days + 1) * kgPerDay,
  }));

const settings: Change = { type: "settings", settings: { tdee: 2500, phaseOffsets: { cut: -500, maintain: 0, bulk: 200 } } };

describe("estimateMaintenance", () => {
  const since = (date: string, phase: "cut" | "maintain"): Change => ({ type: "day.upsert", day: { date, phase, steps: 0, extraKcal: 0 } });

  it("is intake minus the weight trend in kcal", () => {
    const s = state(settings, since("2026-08-01", "cut"), ...weighIns(60, -0.05));
    const estimate = estimateMaintenance(s, END)!;
    expect(estimate.days).toBe(42);
    expect(estimate.intake).toBeCloseTo(2000);
    expect(estimate.kgPerWeek).toBeCloseTo(-0.35);
    expect(estimate.tdee).toBeCloseTo(2000 + 0.05 * KCAL_PER_KG);
  });

  it("uses logged intake and takes earned steps kcal out", () => {
    const today: Change[] = [
      { type: "food.upsert", food: meal },
      { type: "entry.upsert", entry: { id: "1", date: END, foodId: "meal", amount: 1.5, done: true } },
      { type: "day.upsert", day: { date: END, phase: "maintain", steps: 10_000, extraKcal: 0, offset: 0 } },
    ];
    const s = state(settings, since("2026-08-01", "maintain"), ...weighIns(60, 0), ...today);
    const estimate = estimateMaintenance(s, END)!;
    expect(estimate.logged).toBe(1);
    // 41 days at 2500, one logged day at 3000 minus 370 earned
    expect(estimate.intake).toBeCloseTo((41 * 2500 + 3000 - 370) / 42);
  });

  it("reads a water drop after a kcal change as water, not fat", () => {
    // maintenance 2500: flat on maintain, then a 1 kg water drop and real loss on cut
    const cutFrom = "2026-10-11";
    const weights = Array.from({ length: 60 }, (_, i): Change => {
      const date = shiftDate(END, i - 59);
      const d = Math.round((Date.parse(date) - Date.parse(cutFrom)) / 86_400_000);
      const kg = d < 0 ? 80 : 80 - Math.min(1, (d + 1) / 3) - (d * 500) / KCAL_PER_KG;
      return { type: "weight", date, kg };
    });
    const s = state(settings, since("2026-08-01", "maintain"), since(cutFrom, "cut"), ...weights);
    expect(estimateMaintenance(s, END)!.tdee).toBeCloseTo(2500);
    expect(estimateMaintenance(s, END)!.settlingSince).toBeUndefined();
    expect(estimateMaintenance(s, "2026-10-13")!.settlingSince).toBe(cutFrom);
  });

  it("needs a couple of weeks of weigh-ins", () => {
    expect(estimateMaintenance(state(settings, ...weighIns(9, 0)), END)).toBeUndefined();
  });
});

describe("weightSeries", () => {
  it("averages the weigh-ins of the 7 days ending on each one", () => {
    const series = weightSeries(state({ type: "weight", date: "2026-10-01", kg: 80 }, { type: "weight", date: "2026-10-07", kg: 82 }, { type: "weight", date: "2026-10-08", kg: 84 }));
    expect(series.map((p) => p.avg)).toEqual([80, 81, 83]);
  });
});
