import { describe, expect, it } from "vitest";
import { shiftDate } from "./day";
import { fold, stamp } from "./state";
import type { Change, Food, Phase } from "./types";
import { daysBetween, KCAL_PER_KG, regionReading, stretches, weightSeries } from "./weight";

const END = "2026-10-31";
const meal: Food = { id: "meal", name: "meal", basis: "item", group: "", fav: false, note: "", kcal: 2000 };

let clock = 0;
const state = (...changes: Change[]) =>
  fold(changes.map((change) => stamp(change, "desktop", new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)))));

const settings: Change = { type: "settings", settings: { tdee: 2500, phaseOffsets: { cut: -500, maintain: 0, bulk: 200 } } };
const since = (date: string, phase: Phase): Change => ({ type: "day.upsert", day: { date, phase, steps: 0, extraKcal: 0 } });

/** Daily weigh-ins for the last `days` days, from a function of the date. */
const weighIns = (days: number, kg: (date: string) => number): Change[] =>
  Array.from({ length: days }, (_, i) => {
    const date = shiftDate(END, i - days + 1);
    return { type: "weight", date, kg: kg(date) };
  });

describe("regionReading", () => {
  const steady = state(settings, since("2026-08-01", "cut"), ...weighIns(60, (d) => 80 + daysBetween(d, END) * 0.05));

  it("reads every day it was given, with a line through the weigh-ins", () => {
    const region = regionReading(steady, shiftDate(END, -6), END)!;
    expect(region.days).toBe(7);
    expect(region.weighIns).toBe(7);
    expect(region.intake).toBeCloseTo(2000);
    expect(region.tdee).toBeCloseTo(2000 + 0.05 * KCAL_PER_KG);
    expect(region.kgPerWeek).toBeCloseTo(-0.35);
    expect(region.fromKg).toBeCloseTo(80.3);
    expect(region.toKg).toBeCloseTo(80);
  });

  it("matches a phase's reading over the same days", () => {
    const [cut] = stretches(steady, END);
    expect(regionReading(steady, cut.fitFrom, END)!.tdee).toBeCloseTo(cut.tdee!);
  });

  it("needs two weigh-ins", () => {
    expect(regionReading(steady, END, END)).toBeUndefined();
    expect(regionReading(steady, "2020-01-01", "2020-02-01")).toBeUndefined();
  });
});

describe("stretches", () => {
  it("reads maintenance as intake minus the weight trend", () => {
    const s = state(settings, since("2026-08-01", "cut"), ...weighIns(60, (d) => 80 + daysBetween(d, END) * 0.05));
    const [cut] = stretches(s, END);
    expect(cut.days).toBe(60);
    expect(cut.fitFrom).toBe(shiftDate(END, -41));
    expect(cut.intake).toBeCloseTo(2000);
    expect(cut.kgPerWeek).toBeCloseTo(-0.35);
    expect(cut.tdee).toBeCloseTo(2000 + 0.05 * KCAL_PER_KG);
  });

  it("uses logged intake and takes earned steps kcal out", () => {
    const s = state(
      settings,
      since("2026-08-01", "maintain"),
      ...weighIns(60, () => 80),
      { type: "food.upsert", food: meal },
      { type: "entry.upsert", entry: { id: "1", date: END, foodId: "meal", amount: 1.5, done: true } },
      // planned and never ticked: not eaten, on either day
      { type: "entry.upsert", entry: { id: "2", date: END, foodId: "meal", amount: 0.25, done: false } },
      { type: "entry.upsert", entry: { id: "3", date: shiftDate(END, -1), foodId: "meal", amount: 1, done: false } },
      { type: "day.upsert", day: { date: END, phase: "maintain", steps: 10_000, extraKcal: 0, offset: 0 } },
    );
    const [maintain] = stretches(s, END);
    expect(maintain.logged).toBe(1);
    // 41 days at 2500, one logged day at 3000 minus 370 earned
    expect(maintain.intake).toBeCloseTo((41 * 2500 + 3000 - 370) / 42);
  });

  it("keeps maintenance correct when unused calories are eaten the next day", () => {
    const changes: Change[] = [settings, { type: "food.upsert", food: meal }];
    let kg = 80;
    const activity = 37 + 100;
    for (let i = 0; i < 60; i++) {
      const date = shiftDate(END, i - 59);
      const eaten = (i % 2 ? 2200 : 1800) + activity;
      changes.push(
        { type: "day.upsert", day: { date, phase: "cut", steps: 1000, extraKcal: 100, rolloverKcal: i % 2 ? 200 : 0 } },
        { type: "weight", date, kg },
        { type: "entry.upsert", entry: { id: date, date, foodId: meal.id, amount: eaten / meal.kcal, done: true } },
      );
      kg += (eaten - 2500 - activity) / KCAL_PER_KG;
    }
    const [cut] = stretches(state(...changes), END);
    expect(cut.logged).toBe(42);
    expect(cut.intake).toBeCloseTo(2000);
    expect(cut.tdee).toBeCloseTo(2500);
  });

  it("includes rollover once when assuming an unlogged day was eaten to target", () => {
    const s = state(
      settings,
      since("2026-08-01", "maintain"),
      ...weighIns(60, () => 80),
      { type: "day.upsert", day: { date: END, phase: "maintain", steps: 1000, extraKcal: 100, rolloverKcal: 200 } },
    );
    const [maintain] = stretches(s, END);
    expect(maintain.logged).toBe(0);
    expect(maintain.intake).toBeCloseTo((41 * 2500 + 2700) / 42);
  });

  it("gives each phase its own maintenance and leaves out the water drop", () => {
    // maintenance 2500 while maintaining, 2200 once cutting, plus a 1 kg water drop
    const cutFrom = "2026-10-01";
    const s = state(
      settings,
      since("2026-08-01", "maintain"),
      since(cutFrom, "cut"),
      ...weighIns(60, (date) => {
        const d = daysBetween(cutFrom, date);
        return d < 0 ? 80 : 80 - Math.min(1, (d + 1) / 3) - (d * (2200 - 2000)) / KCAL_PER_KG;
      }),
    );
    const [maintain, cut] = stretches(s, END);
    expect([maintain.phase, maintain.to, cut.phase, cut.from]).toEqual(["maintain", "2026-09-30", "cut", cutFrom]);
    expect(maintain.tdee).toBeCloseTo(2500);
    expect(cut.tdee).toBeCloseTo(2200);
  });

  it("doesn't split a phase for a refeed shorter than a week", () => {
    const s = state(settings, since("2026-08-01", "cut"), since("2026-10-10", "maintain"), since("2026-10-13", "cut"), ...weighIns(60, () => 80));
    expect(stretches(s, END).map((st) => st.phase)).toEqual(["cut"]);
  });

  it("folds a maintain phase under three weeks into the cuts or bulks around it", () => {
    const between = (outer: Phase, days: number, middle: Phase = "maintain") => {
      const resume = shiftDate("2026-09-01", days);
      const s = state(settings, since("2026-08-01", outer), since("2026-09-01", middle), since(resume, outer), ...weighIns(91, () => 80));
      return stretches(s, END).map((st) => st.phase);
    };
    expect(between("cut", 20)).toEqual(["cut"]);
    expect(between("bulk", 20)).toEqual(["bulk"]);
    expect(between("cut", 21)).toEqual(["cut", "maintain", "cut"]);
    // only maintaining pauses a phase: a longer bulk still counts as its own
    expect(between("maintain", 10, "bulk")).toEqual(["maintain", "bulk", "maintain"]);
  });

  it("gives a short maintain phase between a cut and a bulk to the bulk", () => {
    const runs = (first: Phase, then: Phase, days: number) => {
      const s = state(settings, since("2026-08-01", first), since("2026-09-01", "maintain"), since(shiftDate("2026-09-01", days), then), ...weighIns(91, () => 80));
      return stretches(s, END).map((st) => `${st.phase} ${st.from} ${st.to}`);
    };
    expect(runs("cut", "bulk", 20)).toEqual(["cut 2026-08-02 2026-08-31", `bulk 2026-09-01 ${END}`]);
    expect(runs("bulk", "cut", 20)).toEqual(["bulk 2026-08-02 2026-09-20", `cut 2026-09-21 ${END}`]);
    expect(runs("cut", "bulk", 21)).toEqual(["cut 2026-08-02 2026-08-31", "maintain 2026-09-01 2026-09-21", `bulk 2026-09-22 ${END}`]);
  });

  it("doesn't let a refeed turn a long maintain phase into a bulk", () => {
    const s = state(settings, since("2026-08-02", "maintain"), since("2026-08-12", "bulk"), since("2026-08-14", "maintain"), since("2026-10-20", "cut"), ...weighIns(91, () => 80));
    expect(stretches(s, END).map((st) => `${st.phase} ${st.from}`)).toEqual(["maintain 2026-08-02", "cut 2026-10-20"]);
  });

  it("keeps the maintain phase you are in as its own until the next phase starts", () => {
    const s = state(settings, since("2026-08-01", "bulk"), since("2026-10-25", "maintain"), ...weighIns(91, () => 80));
    expect(stretches(s, END).map((st) => st.phase)).toEqual(["bulk", "maintain"]);
  });

  it("waits for two weeks of weigh-ins after a phase starts", () => {
    const s = state(settings, since("2026-08-01", "maintain"), since("2026-10-14", "bulk"), ...weighIns(60, () => 80));
    const early = stretches(s, "2026-10-30").at(-1)!;
    expect(early.tdee).toBeUndefined();
    expect(early.readyOn).toBe(END);
    expect(stretches(s, END).at(-1)!.tdee).toBeCloseTo(2700);
  });

  it("skips the set number of days after a phase starts", () => {
    const skipping = (settleDays: number) => {
      const s = state(settings, { type: "settings", settings: { settleDays } }, since("2026-10-01", "cut"), ...weighIns(31, () => 80));
      return stretches(s, END)[0];
    };
    expect(skipping(4).fitFrom).toBe("2026-10-05");
    expect(skipping(0).fitFrom).toBe("2026-10-01");
    expect(skipping(10).fitFrom).toBe("2026-10-11");
    expect(skipping(10).readyOn).toBe("2026-10-24");
  });
});

describe("weightSeries", () => {
  it("averages the weigh-ins of the 7 days ending on each one", () => {
    const series = weightSeries(state({ type: "weight", date: "2026-10-01", kg: 80 }, { type: "weight", date: "2026-10-07", kg: 82 }, { type: "weight", date: "2026-10-08", kg: 84 }));
    expect(series.map((p) => p.avg)).toEqual([80, 81, 83]);
  });
});
