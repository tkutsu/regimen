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
  it("preserves a source-name review flag until it is cleared explicitly", () => {
    const flagged = { ...feta, nameNeedsReview: true };
    const form = toForm(flagged);
    expect(fromForm(form, feta.id)).toEqual(flagged);
    form.nameNeedsReview = false;
    expect(fromForm(form, feta.id)).toEqual(feta);
  });

  it("saves comma-separated keywords separately from the display name", () => {
    const form = toForm(feta);
    form.keywords = " φέτα, white cheese, , φέτα, τυρί ";
    const saved = fromForm(form, feta.id)!;
    expect(saved.name).toBe("feta");
    expect(saved.keywords).toEqual(["φέτα", "white cheese", "τυρί"]);
    expect(fromForm(toForm(saved), feta.id)).toEqual(saved);
  });

  it("allows keywords to be removed and keeps old foods compatible", () => {
    expect(toForm().keywords).toBe("");
    expect(toForm(feta).keywords).toBe("");
    const form = toForm({ ...feta, keywords: ["φέτα"] });
    form.keywords = " , ";
    expect(fromForm(form, feta.id)).toEqual(feta);
  });

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
