import { describe, expect, it } from "vitest";
import { searchFoods } from "./search";
import type { Food } from "./types";

const food = (name: string, fav = false): Food => ({
  id: name,
  name,
  basis: "100g",
  group: "",
  fav,
  note: "",
  kcal: 0,
  prot: 0,
  fiber: 0,
  satFat: 0,
  unsatFat: 0,
  salt: 0,
  sugar: 0,
});

const names = (foods: Food[]) => foods.map((f) => f.name);

describe("searchFoods", () => {
  it("matches every word in any order, ignoring case and accents", () => {
    const foods = [food("Peppers, sweet, red, raw"), food("Pepper, black"), food("Crème fraîche")];
    expect(names(searchFoods(foods, "red pepper"))).toEqual(["Peppers, sweet, red, raw"]);
    expect(names(searchFoods(foods, "creme"))).toEqual(["Crème fraîche"]);
  });

  it("matches Greek without tonos or final-sigma differences", () => {
    const foods = [food("Τραχανάς γλυκός"), food("Γιαούρτι 2%")];
    expect(names(searchFoods(foods, "τραχανασ"))).toEqual(["Τραχανάς γλυκός"]);
    expect(names(searchFoods(foods, "γιαουρτι"))).toEqual(["Γιαούρτι 2%"]);
  });

  it("ranks whole-word starts over substrings, then shorter names", () => {
    const foods = [food("eggplant"), food("egg, whole, raw, fresh"), food("egg")];
    expect(names(searchFoods(foods, "egg"))).toEqual(["egg", "egg, whole, raw, fresh", "eggplant"]);
  });

  it("puts favourites first", () => {
    const foods = [food("oats"), food("overnight oats", true)];
    expect(names(searchFoods(foods, "oats"))[0]).toBe("overnight oats");
  });

  it("forgives a typo from four letters on, two from seven", () => {
    const foods = [food("Chicken breast, roasted"), food("Γιαούρτι 2%"), food("Rice, white")];
    expect(names(searchFoods(foods, "chiken brest"))).toEqual(["Chicken breast, roasted"]);
    expect(names(searchFoods(foods, "chcikne"))).toEqual(["Chicken breast, roasted"]);
    expect(names(searchFoods(foods, "γιαουτρι"))).toEqual(["Γιαούρτι 2%"]);
    expect(names(searchFoods(foods, "ruce"))).toEqual(["Rice, white"]);
    expect(names(searchFoods(foods, "rcie"))).toEqual(["Rice, white"]);
    expect(searchFoods(foods, "rce")).toEqual([]);
    expect(searchFoods(foods, "chkn")).toEqual([]);
  });

  it("ranks exact matches over typos", () => {
    const foods = [food("ricotta"), food("rice")];
    expect(names(searchFoods(foods, "rice"))).toEqual(["rice", "ricotta"]);
  });

  it("ranks recently used foods first, the most recent highest", () => {
    const foods = [food("egg"), food("eggplant"), food("egg noodles")];
    expect(names(searchFoods(foods, "egg", 50, ["egg noodles", "eggplant"]))).toEqual(["egg noodles", "eggplant", "egg"]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchFoods([food("oats")], "  ")).toEqual([]);
  });
});
