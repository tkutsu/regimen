import { describe, expect, it } from "vitest";
import { fromForm, toForm } from "./foodForm";
import type { Food } from "./types";

const feta: Food = {
  id: "feta",
  name: "feta",
  basis: "100g",
  group: "dairy & eggs",
  fav: false,
  note: "",
  kcal: 265,
  prot: 14.2,
  fiber: 0,
  satFat: 13.3,
  unsatFat: 5.2,
  salt: 2.85,
  variants: [{ name: "crumbled", factor: 1 }],
};

describe("food form", () => {
  it("round-trips a food, keeping unknown apart from 0", () => {
    const form = toForm(feta);
    expect(form.values.sugar).toBe("");
    expect(form.values.fiber).toBe("0");
    expect(fromForm(form, "feta")).toEqual(feta);
  });

  it("refuses numbers too big to save", () => {
    const form = toForm(feta);
    expect(fromForm({ ...form, values: { ...form.values, kcal: "Infinity" } }, "feta")).toBeUndefined();
    expect(fromForm({ ...form, values: { ...form.values, salt: "1e309" } }, "feta")).toBeUndefined();
  });

  it("reads decimal commas and leaves blanks unknown", () => {
    const form = toForm();
    form.name = " test jam ";
    form.values.kcal = "72";
    form.values.salt = "0,08";
    const food = fromForm(form, "x")!;
    expect(food.name).toBe("test jam");
    expect(food.salt).toBe(0.08);
    expect("sugar" in food).toBe(false);
  });

  it("needs a name, kcal and numbers that make sense", () => {
    const form = toForm(feta);
    expect(fromForm({ ...form, name: " " }, "feta")).toBeUndefined();
    expect(fromForm({ ...form, values: { ...form.values, kcal: "" } }, "feta")).toBeUndefined();
    expect(fromForm({ ...form, values: { ...form.values, prot: "-1" } }, "feta")).toBeUndefined();
    expect(fromForm({ ...form, values: { ...form.values, salt: "lots" } }, "feta")).toBeUndefined();
  });

  it("drops empty variant rows and rejects half-filled ones", () => {
    const form = toForm(feta);
    expect(fromForm({ ...form, variants: [{ name: "", factor: "" }] }, "feta")!.variants).toBeUndefined();
    expect(fromForm({ ...form, variants: [{ name: "raw", factor: "" }] }, "feta")).toBeUndefined();
    expect(fromForm({ ...form, variants: [{ name: "raw", factor: "0" }] }, "feta")).toBeUndefined();
  });
});
