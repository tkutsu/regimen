import { describe, expect, it } from "vitest";
import { parseAmount, scale } from "./nutrition";
import type { Food } from "./types";

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
    variants: [{ name: "raw", factor: 2.4 }],
  };

  it("applies a variant's factor", () => {
    expect(scale(pasta, 100, 2.4).kcal).toBeCloseTo(360);
    expect(scale(pasta, 100).kcal).toBe(150);
  });
});
